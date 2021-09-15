import { defineLayout } from '@directus/shared/utils';
import KanbanLayout from './kanban.vue';
import KanbanOptions from './options.vue';
import KanbanSidebar from './sidebar.vue';
import KanbanActions from './actions.vue';

import { ChangeEvent, Group, Item, LayoutOptions, LayoutQuery } from './types';
import useSync from '@/composables/use-sync';
import useCollection from '@/composables/use-collection';
import useItems from '@/composables/use-items';
import { computed, toRefs } from 'vue';
import { useRelationsStore } from '@/stores';
import { getFieldsFromTemplate } from '@/utils/get-fields-from-template';
import { getRelationType } from '@/utils/get-relation-type';
import { useGroups } from './useGroups';
import api, { addTokenToURL } from '@/api';
import { getRootPath } from '@/utils/get-root-path';
import { filterFields } from '@/utils/filter-fields';

export default defineLayout<LayoutOptions, LayoutQuery>({
	id: 'kanban',
	name: '$t:layouts.kanban.kanban',
	icon: 'view_week',
	component: KanbanLayout,
	slots: {
		options: KanbanOptions,
		sidebar: KanbanSidebar,
		actions: KanbanActions,
	},
	setup(props, { emit }) {
		const relationsStore = useRelationsStore();

		const layoutOptions = useSync(props, 'layoutOptions', emit);
		const layoutQuery = useSync(props, 'layoutQuery', emit);
		const filters = useSync(props, 'filters', emit);
		const searchQuery = useSync(props, 'searchQuery', emit);

		const { collection } = toRefs(props);
		const { sort, limit, page, fields } = useLayoutQuery();
		const { info, primaryKeyField, fields: fieldsInCollection, sortField } = useCollection(collection);

		const { fieldGroups } = filterFields(fieldsInCollection, {
			text: (field) => field.type === 'string' || field.type === 'text',
			tags: (field) => field.type === 'json' || field.type === 'csv',
			date: (field) => ['date', 'time', 'dateTime', 'timestamp'].includes(field.type),
			user: (field) => field.type === 'uuid',
			group: (field) => {
				const relation = relationsStore.relations.find(
					(relation) => getRelationType({ relation, collection: collection.value, field: field.field }) === 'm2o'
				);
				return !!relation;
			},
			file: (field) => {
				if (field.field === '$thumbnail') return true;

				const relation = relationsStore.relations.find((relation) => {
					return (
						relation.collection === props.collection &&
						relation.field === field.field &&
						relation.related_collection === 'directus_files'
					);
				});

				return !!relation;
			},
		});

		const { groupField, groupTitle, imageSource, title, textField, crop, dateField, tagsField, userField } =
			useLayoutOptions();
		const {
			items: groups,
			groupTitleFields,
			primaryKeyField: groupPrimaryKeyField,
			changeGroups,
			sortField: groupSortField,
		} = useGroups(collection, groupField, groupTitle);

		const { items, loading, error, totalPages, itemCount, totalCount, changeManualSort } = useItems(collection, {
			sort,
			limit,
			page,
			fields,
			filters: filters,
			searchQuery: searchQuery,
		});

		const groupedItems = computed<Group[]>(() => {
			const gpkField = groupPrimaryKeyField.value?.field;
			const titleField = groupTitle.value;
			const group = groupField.value;

			const pkField = primaryKeyField.value?.field;

			if (pkField === undefined || gpkField === undefined || titleField === null || group === null) return [];

			const itemGroups: Record<string | number, Group> = {};
			groups.value.forEach((group, index) => {
				itemGroups[group[gpkField]] = { id: group[gpkField], title: group[titleField], items: [], sort: index };
			});

			items.value.forEach((item, index) => {
				if (item[group] in itemGroups)
					itemGroups[item[group]].items.push({
						id: item[pkField],
						title: title.value ?? undefined,
						text: textField.value ? item[textField.value] : undefined,
						image: imageSource.value ? parseUrl(item[imageSource.value]) : undefined,
						date: dateField.value ? item[dateField.value] : undefined,
						dateType: fieldGroups.value.date.find((field) => field.field === dateField.value)?.type,
						tags: tagsField.value ? item[tagsField.value] : undefined,
						sort: index,
						user: userField.value ? item[userField.value] : undefined,
						item,
					});
			});

			return Object.values(itemGroups).sort((a, b) => a.sort - b.sort);
		});

		return {
			groupedItems,
			groupPrimaryKeyField,
			groups,
			groupTitle,
			groupTitleFields,
			groupField,
			imageSource,
			title,
			textField,
			crop,
			items,
			loading,
			error,
			totalPages,
			page,
			itemCount,
			totalCount,
			fieldsInCollection,
			fields,
			limit,
			primaryKeyField,
			info,
			sortField,
			changeManualSort,
			dateField,
			tagsField,
			change,
			changeGroups,
			groupSortField,
			fieldGroups,
			userField,
		};

		async function change(group: Group, event: ChangeEvent<Item>) {
			const gField = groupField.value;
			const pkField = primaryKeyField.value?.field;

			if (gField === null || pkField === undefined || event.removed) return;

			if (event.moved) {
				await changeManualSort({
					item: group.items[event.moved.oldIndex].id,
					to: group.items[event.moved.newIndex].id,
				});
			} else if (event.added) {
				const itemIndex = items.value.findIndex((item) => item[pkField] === event.added?.element.id);

				items.value[itemIndex][gField] = group.id;

				if (group.items.length > 0) {
					const item = event.added.element;
					const before = group.items[event.added.newIndex - 1] as Item | undefined;
					const after = group.items[event.added.newIndex] as Item | undefined;

					if (item.sort !== undefined) {
						if (after?.sort !== undefined && after.sort < item.sort) {
							await changeManualSort({ item: item.id, to: after.id });
						} else if (before?.sort !== undefined && before.sort > item.sort) {
							await changeManualSort({ item: item.id, to: before.id });
						}
					}
				}

				await api.patch(`/items/${collection.value}/${event.added.element.id}`, {
					[gField]: group.id,
				});
			}
		}

		function parseUrl(file: Record<string, any>) {
			if (!file || !file.type) return;
			if (file.type.startsWith('image') === false) return;
			if (file.type.includes('svg')) return;

			const fit = crop.value ? '&width=250&height=150' : `&key=system-medium-contain`;

			const url = getRootPath() + `assets/${file.id}?modified=${file.modified_on}` + fit;
			return addTokenToURL(url);
		}

		function useLayoutOptions() {
			const groupField = createViewOption<string | null>('groupField', fieldGroups.value.group[0]?.field ?? null);
			const groupTitle = createViewOption<string | null>('groupTitle', null);
			const dateField = createViewOption<string | null>('dateField', fieldGroups.value.date[0]?.field ?? null);
			const tagsField = createViewOption<string | null>('tagsField', fieldGroups.value.tags[0]?.field ?? null);
			const userField = createViewOption<string | null>('tagsField', fieldGroups.value.user[0]?.field ?? null);
			const textField = createViewOption<string | null>('text', fieldGroups.value.text[0]?.field ?? null);
			const title = createViewOption<string | null>('title', null);
			const imageSource = createViewOption<string | null>('imageSource', fieldGroups.value.file[0]?.field ?? null);
			const crop = createViewOption<boolean>('crop', true);

			return { groupField, groupTitle, imageSource, title, textField, crop, dateField, tagsField, userField };

			function createViewOption<T>(key: keyof LayoutOptions, defaultValue: any) {
				return computed<T>({
					get() {
						return layoutOptions.value?.[key] !== undefined ? layoutOptions.value?.[key] : defaultValue;
					},
					set(newValue: T) {
						layoutOptions.value = {
							...layoutOptions.value,
							[key]: newValue,
						};
					},
				});
			}
		}

		function useLayoutQuery() {
			const page = computed({
				get() {
					return layoutQuery.value?.page || 1;
				},
				set(newPage: number) {
					layoutQuery.value = {
						...(layoutQuery.value || {}),
						page: newPage,
					};
				},
			});

			const sort = computed(() => sortField.value || primaryKeyField.value?.field || '');

			const limit = computed({
				get() {
					return layoutQuery.value?.limit || 25;
				},
				set(newLimit: number) {
					layoutQuery.value = {
						...(layoutQuery.value || {}),
						page: 1,
						limit: newLimit,
					};
				},
			});

			const fields = computed<string[]>(() => {
				if (!primaryKeyField.value || !props.collection) return [];
				const fields = [primaryKeyField.value.field];

				if (imageSource.value) {
					fields.push(`${imageSource.value}.modified_on`);
					fields.push(`${imageSource.value}.type`);
					fields.push(`${imageSource.value}.filename_disk`);
					fields.push(`${imageSource.value}.storage`);
					fields.push(`${imageSource.value}.id`);
				}

				if (userField.value) {
					fields.push(`${userField.value}.*`);
				}

				if (props.collection === 'directus_files' && imageSource.value === '$thumbnail') {
					fields.push('modified_on');
					fields.push('type');
				}

				if (sort.value) {
					const sortField = sort.value.startsWith('-') ? sort.value.substring(1) : sort.value;

					if (fields.includes(sortField) === false) {
						fields.push(sortField);
					}
				}

				[groupField.value, textField.value, tagsField.value, dateField.value].forEach((val) => {
					if (val !== null) fields.push(val);
				});

				const titleSubtitleFields: string[] = [];

				if (title.value) {
					titleSubtitleFields.push(...getFieldsFromTemplate(title.value));
				}

				return [...fields, ...titleSubtitleFields];
			});

			return { sort, limit, page, fields };
		}
	},
});
