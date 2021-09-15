<template>
	<draggable
		:model-value="groupedItems"
		group="groups"
		draggable=".group"
		item-key="id"
		class="kanban"
		:animation="150"
		:disabled="groupSortField === null"
		@change="changeGroups"
	>
		<template #item="{ element: group }">
			<div class="group">
				<div class="header">
					<div class="title">
						{{ group.title }}
						<span class="badge">{{ group.items.length }}</span>
					</div>
					<div class="actions">
						<router-link :to="`${collection}/+`"><v-icon name="add" /></router-link>
						<v-menu show-arrow>
							<template #activator="{ toggle }">
								<v-icon name="more_horiz" clickable @click="toggle" />
							</template>

							<div>Option A</div>
							<div>Option B</div>
						</v-menu>
					</div>
				</div>
				<draggable
					:model-value="group.items"
					group="items"
					draggable=".item"
					:animation="150"
					:disabled="sortField === null"
					class="items"
					item-key="id"
					@change="change(group, $event)"
				>
					<template #item="{ element }">
						<router-link :to="`${collection}/${element.id}`" class="item">
							<render-template
								:collection="collection"
								:fields="fieldsInCollection"
								:item="element.item"
								:template="element.title"
							/>
							<img v-if="element.image" :src="element.image" />
							<div v-if="element.text" class="text">{{ element.text }}</div>
							<display-labels
								v-if="element.tags"
								:value="element.tags"
								:type="Array.isArray(element.tags) ? 'csv' : 'json'"
							/>
							<!-- <v-avatar  /> -->
							<display-datetime v-if="element.date" format="short" :value="element.date" :type="element.dateType" />
						</router-link>
					</template>
				</draggable>
			</div>
		</template>
	</draggable>
</template>

<script lang="ts">
import { useI18n } from 'vue-i18n';
import { defineComponent, PropType } from 'vue';
import { Field } from '@directus/shared/types';
import { ChangeEvent, Group, Item } from './types';
import Draggable from 'vuedraggable';

export default defineComponent({
	components: { Draggable },
	inheritAttrs: false,
	props: {
		collection: {
			type: String,
			default: null,
		},
		fieldsInCollection: {
			type: Array as PropType<Field[]>,
			default: () => [],
		},
		primaryKeyField: {
			type: Object as PropType<Field>,
			default: null,
		},
		groupedItems: {
			type: Array as PropType<Group[]>,
			default: () => [],
		},
		groupTitle: {
			type: String,
			default: null,
		},
		groupPrimaryKeyField: {
			type: Object as PropType<Field>,
			default: null,
		},
		change: {
			type: Function as PropType<(group: Group, event: ChangeEvent<Item>) => void>,
			default: null,
		},
		changeGroups: {
			type: Function as PropType<(event: ChangeEvent<Group>) => void>,
			default: null,
		},
		sortField: {
			type: String,
			default: null,
		},
		userField: {
			type: String,
			default: null,
		},
		groupSortField: {
			type: String,
			default: null,
		},
	},
	emits: ['update:selection', 'update:limit', 'update:size', 'update:sort', 'update:width'],
	setup() {
		const { t } = useI18n();

		return { t };
	},
});
</script>

<style lang="scss" scoped>
.kanban {
	display: flex;
	height: calc(100% - 65px - 2 * 24px);
	padding: 0px 32px 24px 32px;
	overflow-x: auto;
	overflow-y: hidden;

	.group {
		display: flex;
		flex-direction: column;
		min-width: 300px;
		padding: 8px 0;
		background-color: var(--background-normal);
		border: var(--border-width) solid var(--border-normal);
		border-radius: var(--border-radius);

		&:not(:last-child) {
			margin-right: 20px;
		}

		.header {
			display: flex;
			justify-content: space-between;
			margin: 0 16px 8px 16px;
			font-weight: 700;

			.badge {
				display: inline-flex;
				justify-content: center;
				width: 24px;
				height: 24px;
				text-align: center;
				background-color: var(--background-normal-alt);
				border-radius: 50%;
			}

			.actions {
				color: var(--foreground-subdued);

				& > .v-icon {
					margin-left: 8px;
				}
			}
		}

		.items {
			flex: 1;
			overflow-x: hidden;
			overflow-y: auto;

			.item {
				display: block;
				margin: 0 16px 6px 16px;
				padding: 8px 16px;
				background-color: var(--background-page);
				border-radius: var(--border-radius);
				// border: var(--border-width) solid var(--border-normal);
				box-shadow: 2px 2px 8px 0px var(--background-normal-alt);
			}

			.render-template {
				font-weight: 700;
			}

			img {
				width: 100%;
				margin-top: 10px;
				border-radius: var(--border-radius);
				// height: 300px;
			}

			.display-labels {
				margin-top: 10px;
			}

			.datetime {
				display: inline-block;
				width: 100%;
				margin-top: 10px;
				color: var(--foreground-subdued);
				text-align: end;
			}
		}
	}

	.spacer {
		min-width: 12px;
		height: 100%;
	}
}
</style>
