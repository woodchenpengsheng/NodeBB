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
			const execute = function (ok) {
				if (!ok) {
					return;
				}
				api.put(`/topics/${tid}/unlockContact`, {})
					.then((currentReputation) => {
						alerts.success(`解锁成功，您现在的声望值为：${currentReputation}，2秒后自动刷新当前页面`);
						setTimeout(() => {
							window.location.reload();
						}, 4000);
					})
					.catch(alerts.error);
			};

			const message = '[[topic:topic_unlock_contact,' + $('[component="topic/consume-reputation"]').text() + ']]';
			bootbox.confirm(message, execute);
			return false;
		});
	};
	return unlockContact;
});
