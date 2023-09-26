'use strict';

const _ = require('lodash');
const db = require('../database');
const topics = require('.');
const user = require('../user');
const cache = require('../cache');
const utils = require('../utils');


const LockContact = module.exports;

// db.objects.deleteMany({"_key": {
// $regex: /^(:?uid|tid):[^:]+:contact$/
// }})

// db.objects.find({"_key": {
// $regex: /^(:?uid|tid):[^:]+:contact$/
// }})

LockContact.load = async function (topicsData, uid) {
	const topicsWithUnLock = await Promise.all(
		topicsData.map(async (t) => {
			if (!t) {
				return false;
			}

			const checkResult = await LockContact.isTopicNeedUnLock(t.tid);
			// 如果当前topic不需要进行解锁，直接返回true
			if (!checkResult) {
				return true;
			}

			const [isAdmin, isGlobalMod] = await Promise.all([
				user.isAdministrator(uid),
				user.isGlobalModerator(uid),
			]);

			// 如果是管理员或者板块负责人的话，免所打开
			if (isAdmin || isGlobalMod) {
				return true;
			}

			if (parseInt(t.numUnLockContact, 10) <= 0) {
				return false;
			}

			return await LockContact.isUnLockContact(uid, t.tid);
		})
	);

	const filteredTopics = topicsData.filter((_, index) => topicsWithUnLock[index]);
	const tidsWithUnLock = filteredTopics.map(t => t.tid);
	const unLockContacts = tidsWithUnLock.map(() => true);
	const tidToUnlockContacts = _.zipObject(tidsWithUnLock, unLockContacts);
	return topicsData.map(t => (t && t.tid ? (tidToUnlockContacts[t.tid] || false) : false));
};


LockContact.unLockContact = async function (uid, tid) {
	const key = `tid:${tid}:contact`;
	const now = Date.now();
	await db.sortedSetAdd(key, now, uid);
	const numUnLockContact = await db.sortedSetCard(key);
	await topics.setTopicField(tid, 'numUnLockContact', numUnLockContact);
};

// 获得某一个tid下所有的解锁用户
LockContact.getUnLockContacts = async function (tid) {
	return await db.getSortedSetRange(`tid:${tid}:contact`, 0, -1);
};

LockContact.deleteContact = async function (uid, tid) {
	const key = `tid:${tid}:contact`;
	await db.sortedSetRemove(key, uid);
	const numUnLockContact = await db.sortedSetCard(key);
	await topics.setTopicField(tid, 'numUnLockContact', numUnLockContact);
};

LockContact.deleteAllContact = async function (tid) {
	const key = `tid:${tid}:contact`;
	await db.delete(key);
};

LockContact.isUnLockContact = async function (uid, tid) {
	const key = `tid:${tid}:contact`;
	return await db.isSortedSetMember(key, uid);
};

// < 0表示不要声望值
// == 0或者不存在表示跟随默认值
// > 0表示实际要消耗的声望值
LockContact.updateUnLockContactReputation = async function (tid, consumeReputation) {
	await topics.setTopicField(tid, 'unLockConsumeReputation', consumeReputation);
	const key = `unlock:consume:reputation:check:${tid}`;
	cache.set(key, LockContact._checkTopicNeedUnLock(consumeReputation));
};

LockContact._checkTopicNeedUnLock = function (value) {
	const transformValue = parseInt(value, 10);
	// 传递进来的值不合法，默认就是要解锁的
	if (!utils.isNumber(transformValue)) {
		return true;
	}
	return transformValue >= 0;
};

LockContact.isTopicNeedUnLock = async function (tid) {
	const key = `unlock:consume:reputation:check:${tid}`;
	const value = cache.get(key);
	if (value !== undefined) {
		return value;
	}
	const consumeReputation = await topics.getTopicField(tid, 'unLockConsumeReputation');
	cache.set(key, LockContact._checkTopicNeedUnLock(consumeReputation));
	return cache.get(key);
};
