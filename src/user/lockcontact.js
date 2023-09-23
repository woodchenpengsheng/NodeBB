'use strict';

const db = require('../database');
const posts = require('../posts');

module.exports = function (User) {
	User.unLockContact = async function (uid, tid) {
		const key = `uid:${uid}:contact`;
		const now = Date.now();
		await db.sortedSetAdd(key, now, tid);
	};

	User.deleteContact = async function (uid, tid) {
		const key = `uid:${uid}:contact`;
		await db.sortedSetRemove(key, tid);
	};

	User.deleteAllContact = async function (uid) {
		const key = `uid:${uid}:contact`;
		await db.delete(key);
	};

	// 判断某一个用户在某一个tid下是否已经解锁成功了？
	User.isUnLockContact = async function (uid, tid) {
		const key = `uid:${uid}:contact`;
		return await db.isSortedSetMember(key, tid);
	};

	User.getUnLockContacts = async function (uid) {
		return await db.getSortedSetRange(`uid:${uid}:contact`, 0, -1);
	};

	User.isPrivilegedForUnLockContact = async function (pid, uid) {
		// 判断pid是否为main
		const isMain = await posts.isMain(pid);
		if (!isMain) return false;
		// 判断这个topic是否有identity
		const topicData = await posts.getTopicFields(pid, ['numIdentity', 'tid']);
		if (!topicData.numIdentity) return false;
		// 判断这个用户是否解锁了这个identity
		return await User.isUnLockContact(uid, topicData.tid);
	};
};
