'use strict';

define('topicIdentity', [
	'api', 'bootbox', 'benchpress', 'settings',
], function (api, bootbox, Benchpress, settings) {
	const Identity = {};

	Identity.get = id => api.get(`/topics/${id}/identity`, {});

	Identity.getByPid = pid => api.get(`/posts/${pid}`, {}).then(post => Identity.get(post.tid));

	Identity.updateIdentity = (id, data) => api.post(`/topics/${id}/identity`, data);

	Identity.delete = id => api.del(`/topics/${id}/identity`);

	Identity.deleteByPid = pid => api.get(`/posts/${pid}`, {}).then(post => Identity.delete(post.tid));

	Identity.modal = {};

	Identity.modal.open = function (payload) {
		const { id, pid } = payload;
		let { modal } = payload;
		return new Promise((resolve) => {
			Promise.all([
				Identity.get(id),
				pid ? Identity.getByPid(pid) : [],
			]).then(results => new Promise((resolve) => {
				const identities = results.filter(data => data.identity);
				const identity = identities.length >= 1 ? JSON.parse(identities[0].identity) : undefined;
				// 现阶段最多一个
				resolve(identity);
			})).then(identity => Benchpress.render('modals/topic-identity', { identity })).then((html) => {
				modal = bootbox.dialog({
					title: '[[modules:identity.modal.title]]',
					message: html,
					onEscape: true,
					backdrop: true,
					buttons: {
						add: {
							label: '<i class="fa fa-plus"></i> [[modules:identity.modal.update]]',
							className: 'btn-success',
							callback: async () => {
								// 将数据进行缓存
								const formElement = modal.find('form.topic-identity-modal');
								const value = settings.helper.serializeForm(formElement);
								await Identity.updateIdentity(id, value);
								resolve();
							},
						},
						close: {
							label: '[[modules:identity.modal.clear]]',
							className: 'btn-primary',
							callback: async () => {
								// 判断当前server的数据和本地是否一致，如果一致的话，两边同时删除
								const serverValues = await Identity.getByPid(pid);
								const formElement = modal.find('form.topic-identity-modal');
								const value = settings.helper.serializeForm(formElement);
								if (JSON.stringify(value) === serverValues.identity) {
									await Identity.deleteByPid(pid);
								}
								await Identity.delete(id);
							},
						},
					},
				});
			});
		});
	};

	return Identity;
});
