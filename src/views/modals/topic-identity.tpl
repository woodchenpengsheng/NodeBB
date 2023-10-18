<form class="topic-identity-modal">
	<div class="mb-3">
		<label class="form-label" for="identityLocation">位置</label>
		<input type="text" id="identityLocation" name="identityLocation" class="form-control" placeholder="位置" value="{identity.identityLocation}" />
	</div>
	<div class="mb-3">
		<label class="form-label" for="identityName">名字</label>
		<input type="text" id="identityName" name="identityName" class="form-control" placeholder="名字" value="{identity.identityName}" />
	</div>
	<div class="mb-3">
		<label class="form-label" for="identityPrice">价格</label>
		<input type="text" id="identityPrice" name="identityPrice" class="form-control" placeholder="价格" value="{identity.identityPrice}" />
	</div>
	<div class="mb-3">
		<label class="form-label" for="identityServiceDescription">服务</label>
		<input type="text" id="identityServiceDescription" name="identityServiceDescription" class="form-control" placeholder="服务" value="{identity.identityServiceDescription}" />
	</div>
	<div class="mb-3">
		<label class="form-label" for="identityDescription">介绍</label>
		<input type="text" id="identityDescription" name="identityDescription" class="form-control" placeholder="介绍" value="{identity.identityDescription}" />
	</div>
	<div class="mb-3">
		<label class="form-label" for="identityContactWay">联系方式</label>
		<input type="text" id="identityContactWay" name="identityContactWay" class="form-control" placeholder="联系方式" value="{identity.identityContactWay}" />
	</div>
	<div>
	    <label class="form-label" for="identityStatus">当前状态</label>
        <select class="form-select" id="identityStatus" name="identityStatus" data-value="{identity.identityStatus}">
			<option value="1">[[modules:identity.modal.identityStatus.working]]</option>
			<option value="2">[[modules:identity.modal.identityStatus.breaking]]</option>
			<option value="3">[[modules:identity.modal.identityStatus.checking]]</option>
        </select>
	</div>
</form>