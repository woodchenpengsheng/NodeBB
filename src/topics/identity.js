'use strict';

const _ = require('lodash');
const validator = require('validator');
const cache = require('../cache');
const db = require('../database');

const Identity = module.exports;

Identity.load = async function (topicData) {
	const topicsWithIdentity = topicData.filter(t => t && parseInt(t.numIdentity, 10) > 0);
	const tidsWithIdentitiy = topicsWithIdentity.map(t => t.tid);
	const identities = await Promise.all(tidsWithIdentitiy.map(async (tid) => {
		const value = await Identity.get(tid);
		const parseIdentity = JSON.parse(value.identity);
		if (parseIdentity) {
			parseIdentity.identityStatus = parseIdentity.identityStatus || '1';
			parseIdentity.identityStatusContext = Identity.getIdentitiyStatusContext(parseIdentity.identityStatus);
		}
		return parseIdentity;
	}));
	const tidToIdentities = _.zipObject(tidsWithIdentitiy, identities);
	return topicData.map(t => (t && t.tid ? (tidToIdentities[t.tid] || []) : []));
};

Identity.getIdentitiyStatusContext = function (key = 1) {
	const map = {
		1: '[[modules:identity.modal.identityStatus.working]]',
		2: '[[modules:identity.modal.identityStatus.breaking]]',
		3: '[[modules:identity.modal.identityStatus.checking]]',
	};
	return map[key];
};


Identity.get = async function (tid) {
	const set = `${validator.isUUID(String(tid)) ? 'draft' : 'topic'}:${tid}:identity`;
	const identity = await getIdentity(set);
	return {
		id: tid,
		identity,
	};
};

async function getIdentity(set) {
	const cached = cache.get(set);
	if (cached !== undefined) {
		return cached;
	}// 现阶段理论上有且仅有一个
	const identities = await db.getSortedSetRange(set, 0, -1);
	if (identities.length <= 0) {
		return '';
	}
	cache.set(set, identities[0]);
	return identities[0];
}

Identity.associate = async function ({ id, identity, score }) {
	const isDraft = validator.isUUID(String(id));
	const set = `${isDraft ? 'draft' : 'topic'}:${id}:identity`;
	const timeStamp = Date.now();
	await db.delete(set);
	await db.sortedSetAdd(set, isFinite(score) ? score : timeStamp, identity);
	if (!isDraft) {
		const topics = require('.');
		const numIdentity = await db.sortedSetCard(set);
		await topics.setTopicField(id, 'numIdentity', numIdentity);
	}
	cache.del(set);
};

Identity.migrate = async function (uuid, id) {
	const set = `draft:${uuid}:identity`;
	const identities = await db.getSortedSetRangeWithScores(set, 0, -1);
	// 合并之前，先清除之前的
	await Promise.all(identities.map(async identity => await Identity.associate({
		id,
		identity: identity.value,
		score: identity.score,
	})));
	await db.delete(set);
	cache.del(set);
};

Identity.delete = async function (id) {
	const isDraft = validator.isUUID(String(id));
	const set = `${isDraft ? 'draft' : 'topic'}:${id}:identity`;
	await db.sortedSetsRemoveRangeByScore([set], '-inf', '+inf');
	if (!isDraft) {
		const topics = require('.');
		await topics.setTopicField(id, 'numIdentity', 0);
	}
	cache.del(set);
};
