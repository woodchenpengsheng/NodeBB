'use strict';

const _ = require('lodash');
const db = require('../database');
const topics = require('.');
const user = require('../user');


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

			const [isAdmin, isGlobalMod] = await Promise.all([
				user.isAdministrator(uid),
				user.isGlobalModerator(uid),
			]);

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
