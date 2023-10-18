'use strict';

define('forum/topic/unlockContact', [
	'api',
	'alerts',
], function (api, alerts) {
	const unlockContact = {};
	unlockContact.init = function (tid, topicContainer) {
		if (!topicContainer || !topicContainer.get(0)) {
			return;
		}
		topicContainer.on('click', '[component="topic/unlock-contact"]', function () {
			if (!ajaxify.data.loggedIn) {
				alerts.error('您尚未登陆，6秒后自动跳转到登陆界面，登陆成功后进行解锁。如果尚未注册，需要先点下右下角的小人注册按钮，完成注册哦。', 6000);
				setTimeout(() => {
					window.location.href = config.relative_path + '/login';
				}, 6000);
			} else {
				const execute = function (ok) {
					if (!ok) {
						return;
					}
					api.put(`/topics/${tid}/unlockContact`, {})
						.then((currentReputation) => {
							alerts.success(`解锁成功，您现在的声望值为：${currentReputation}，3秒后自动刷新当前页面`);
							setTimeout(() => {
								window.location.reload();
							}, 3000);
						})
						.catch(alerts.error);
				};

				const message = '[[topic:topic_unlock_contact,' + $('[component="topic/consume-reputation"]').text() + ']]';
				bootbox.confirm(message, execute);
			}
			return false;
		});

		topicContainer.on('click', '[component="recharge/reputation"]', function () {
			if (!ajaxify.data.loggedIn) {
				alerts.error('您尚未登陆，6秒后自动跳转到登陆界面，登陆后才能充声望。如果尚未注册，需要先点下右下角的小人注册按钮，完成注册哦。', 6000);
				setTimeout(() => {
					window.location.href = config.relative_path + '/login';
				}, 6000);
			} else {
				window.location.href = config.relative_path + '/recharge';
			}
			return false;
		});

		topicContainer.on('click', '[component="recharge/vip"]', function () {
			if (!ajaxify.data.loggedIn) {
				alerts.error('您尚未登陆，6秒后自动跳转到登陆界面，登陆后才能开通vip。如果尚未注册，需要先点下右下角的小人注册按钮，完成注册哦。', 6000);
				setTimeout(() => {
					window.location.href = config.relative_path + '/login';
				}, 6000);
			} else {
				window.location.href = config.relative_path + '/recharge';
			}
			return false;
		});

		topicContainer.on('click', '[component="topic/vip-unlock"]', function () {
			if (!ajaxify.data.loggedIn) {
				alerts.error('您尚未登陆，6秒后自动跳转到登陆界面，登陆成功后进行解锁。如果尚未注册，需要先点下右下角的小人注册按钮，完成注册哦。', 6000);
				setTimeout(() => {
					window.location.href = config.relative_path + '/login';
				}, 6000);
			} else {
				api.put(`/topics/${tid}/vipUnLockContact`, {})
					.then(() => {
						alerts.success(`解锁成功，3秒后自动刷新当前页面`);
						setTimeout(() => {
							window.location.reload();
						}, 3000);
					})
					.catch(alerts.error);
			}
			return false;
		});
	};
	return unlockContact;
});
