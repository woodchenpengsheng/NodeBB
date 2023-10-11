'use strict';

const db = require('../database');
const topics = require('../topics');
const plugins = require('../plugins');
const meta = require('../meta');
const privileges = require('../privileges');
const user = require('../user');

module.exports = function (Categories) {
	Categories.getCategoryTopics = async function (data) {
		let results = await plugins.hooks.fire('filter:category.topics.prepare', data);
		const tids = await Categories.getTopicIds(results);
		let topicsData = await topics.getTopicsByTids(tids, data.uid);
		topicsData = await user.blocks.filter(data.uid, topicsData);

		if (!topicsData.length) {
			return { topics: [], uid: data.uid };
		}
		topics.calculateTopicIndices(topicsData, data.start);

		results = await plugins.hooks.fire('filter:category.topics.get', { cid: data.cid, topics: topicsData, uid: data.uid });
		return { topics: results.topics, nextStart: data.stop + 1 };
	};

	Categories.getTopicIds = async function (data) {
		const dataForPinned = { ...data };
		dataForPinned.start = 0;
		dataForPinned.stop = -1;

		const [pinnedTids, set, direction] = await Promise.all([
			Categories.getPinnedTids(dataForPinned),
			Categories.buildTopicsSortedSet(data),
			Categories.getSortedSetRangeDirection(data.sort),
		]);

		// 总共有多少个置顶的
		const totalPinnedCount = pinnedTids.length;
		// 如果是分页的话，当前页面要置顶的。
		const pinnedTidsOnPage = pinnedTids.slice(data.start, data.stop !== -1 ? data.stop + 1 : undefined);
		// 获得实际上的个数
		const pinnedCountOnPage = pinnedTidsOnPage.length;
		// 一页上面有多少个
		const topicsPerPage = data.stop - data.start + 1;
		// 获取剩余的tid
		const normalTidsToGet = Math.max(0, topicsPerPage - pinnedCountOnPage);
		if (!normalTidsToGet && data.stop !== -1) {
			return pinnedTidsOnPage;
		}

		if (plugins.hooks.hasListeners('filter:categories.getTopicIds')) {
			const result = await plugins.hooks.fire('filter:categories.getTopicIds', {
				tids: [],
				data: data,
				pinnedTids: pinnedTidsOnPage,
				allPinnedTids: pinnedTids,
				totalPinnedCount: totalPinnedCount,
				normalTidsToGet: normalTidsToGet,
			});
			return result && result.tids;
		}

		let { start } = data;
		if (start > 0 && totalPinnedCount) {
			start -= totalPinnedCount - pinnedCountOnPage;
		}

		const stop = data.stop === -1 ? data.stop : start + normalTidsToGet - 1;
		let normalTids;
		const reverse = direction === 'highest-to-lowest';
		if (Array.isArray(set)) {
			const weights = set.map((s, index) => (index ? 0 : 1));
			normalTids = await db[reverse ? 'getSortedSetRevIntersect' : 'getSortedSetIntersect']({ sets: set, start: start, stop: stop, weights: weights });
		} else {
			normalTids = await db[reverse ? 'getSortedSetRevRange' : 'getSortedSetRange'](set, start, stop);
		}
		normalTids = normalTids.filter(tid => !pinnedTids.includes(tid));
		const afterCheckExpire = await topics.tools.checkExpire(normalTids);
		normalTids = afterCheckExpire;
		// 未过期的tid
		const notExpireTidsOnPage = pinnedTidsOnPage.concat(normalTids);
		// 判断当前页面上是否还有空间容纳过期的
		const expireTidsToGet = Math.max(0, topicsPerPage - notExpireTidsOnPage.length);
		if (!expireTidsToGet && data.stop !== -1) {
			return notExpireTidsOnPage;
		}

		const totalCount = await Categories.getNormalTidsCount(0, -1, set) + totalPinnedCount;
		let expireStart = data.start;
		if (expireStart > 0 && totalCount) {
			expireStart -= totalCount - notExpireTidsOnPage.length;
		}
		const expireStop = data.stop === -1 ? data.stop : expireStart + expireTidsToGet - 1;
		let expireTids = await Categories.getExpireTids(data.cid, expireStart, expireStop);
		expireTids = expireTids.filter(tid => !notExpireTidsOnPage.includes(tid));

		return notExpireTidsOnPage.concat(expireTids);
	};

	Categories.getTopicCount = async function (data) {
		if (plugins.hooks.hasListeners('filter:categories.getTopicCount')) {
			const result = await plugins.hooks.fire('filter:categories.getTopicCount', {
				topicCount: data.category.topic_count,
				data: data,
			});
			return result && result.topicCount;
		}
		const set = await Categories.buildTopicsSortedSet(data);
		if (Array.isArray(set)) {
			return await db.sortedSetIntersectCard(set);
		} else if (data.targetUid && set) {
			return await db.sortedSetCard(set);
		}
		return data.category.topic_count;
	};

	Categories.buildTopicsSortedSet = async function (data) {
		const { cid } = data;
		let set = `cid:${cid}:tids`;
		const sort = data.sort || (data.settings && data.settings.categoryTopicSort) || meta.config.categoryTopicSort || 'newest_to_oldest';

		if (sort === 'most_posts') {
			set = `cid:${cid}:tids:posts`;
		} else if (sort === 'most_votes') {
			set = `cid:${cid}:tids:votes`;
		} else if (sort === 'most_views') {
			set = `cid:${cid}:tids:views`;
		}

		if (data.tag) {
			if (Array.isArray(data.tag)) {
				set = [set].concat(data.tag.map(tag => `tag:${tag}:topics`));
			} else {
				set = [set, `tag:${data.tag}:topics`];
			}
		}

		if (data.targetUid) {
			set = (Array.isArray(set) ? set : [set]).concat([`cid:${cid}:uid:${data.targetUid}:tids`]);
		}

		const result = await plugins.hooks.fire('filter:categories.buildTopicsSortedSet', {
			set: set,
			data: data,
		});
		return result && result.set;
	};

	Categories.getSortedSetRangeDirection = async function (sort) {
		sort = sort || 'newest_to_oldest';
		const direction = ['newest_to_oldest', 'most_posts', 'most_votes', 'most_views'].includes(sort) ? 'highest-to-lowest' : 'lowest-to-highest';
		const result = await plugins.hooks.fire('filter:categories.getSortedSetRangeDirection', {
			sort: sort,
			direction: direction,
		});
		return result && result.direction;
	};

	Categories.getAllTopicIds = async function (cid, start, stop) {
		return await db.getSortedSetRange([`cid:${cid}:tids:pinned`, `cid:${cid}:tids`, `cid:${cid}:tids:expire`], start, stop);
	};

	Categories.getNormalTidsCount = async function (start, stop, set) {
		let tidsCount = 0;
		if (Array.isArray(set)) {
			const weights = set.map((s, index) => (index ? 0 : 1));
			tidsCount = (await db.getSortedSetIntersect({ sets: set, start: start, stop: stop, weights: weights })).length;
		} else {
			const isNeedAll = start === 0 && stop === -1;
			if (isNeedAll) {
				tidsCount = await db.sortedSetCard(set);
			} else {
				tidsCount = (await db.getSortedSetRange(set, start, stop)).length;
			}
		}
		return tidsCount;
	};

	Categories.getPinnedTids = async function (data) {
		if (plugins.hooks.hasListeners('filter:categories.getPinnedTids')) {
			const result = await plugins.hooks.fire('filter:categories.getPinnedTids', {
				pinnedTids: [],
				data: data,
			});
			return result && result.pinnedTids;
		}
		const [allPinnedTids, canSchedule] = await Promise.all([
			db.getSortedSetRevRange(`cid:${data.cid}:tids:pinned`, data.start, data.stop),
			privileges.categories.can('topics:schedule', data.cid, data.uid),
		]);
		const pinnedTids = canSchedule ? allPinnedTids : await filterScheduledTids(allPinnedTids);

		return await topics.tools.checkPinExpiry(pinnedTids);
	};

	Categories.getExpireTids = async function (cid, start, stop) {
		return await db.getSortedSetRevRange(`cid:${cid}:tids:expire`, start, stop);
	};

	Categories.modifyTopicsByPrivilege = function (topics, privileges) {
		if (!Array.isArray(topics) || !topics.length || privileges.view_deleted) {
			return;
		}

		topics.forEach((topic) => {
			if (!topic.scheduled && topic.deleted && !topic.isOwner) {
				topic.title = '[[topic:topic_is_deleted]]';
				if (topic.hasOwnProperty('titleRaw')) {
					topic.titleRaw = '[[topic:topic_is_deleted]]';
				}
				topic.slug = topic.tid;
				topic.teaser = null;
				topic.noAnchor = true;
				topic.tags = [];
			}
		});
	};

	Categories.onNewPostMade = async function (cid, pinned, postData) {
		if (!cid || !postData) {
			return;
		}
		const promises = [
			db.sortedSetAdd(`cid:${cid}:pids`, postData.timestamp, postData.pid),
			db.incrObjectField(`category:${cid}`, 'post_count'),
		];
		if (!pinned) {
			promises.push(db.sortedSetIncrBy(`cid:${cid}:tids:posts`, 1, postData.tid));
		}
		await Promise.all(promises);
		await Categories.updateRecentTidForCid(cid);
	};

	Categories.onTopicsMoved = async (cids) => {
		await Promise.all(cids.map(async (cid) => {
			await Promise.all([
				Categories.setCategoryField(
					cid, 'topic_count', await db.sortedSetCard(`cid:${cid}:tids:lastposttime`)
				),
				Categories.setCategoryField(
					cid, 'post_count', await db.sortedSetCard(`cid:${cid}:pids`)
				),
				Categories.updateRecentTidForCid(cid),
			]);
		}));
	};

	async function filterScheduledTids(tids) {
		const scores = await db.sortedSetScores('topics:scheduled', tids);
		const now = Date.now();
		return tids.filter((tid, index) => tid && (!scores[index] || scores[index] <= now));
	}
};
