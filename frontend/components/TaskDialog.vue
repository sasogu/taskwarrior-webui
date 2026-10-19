<template>
	<v-dialog
		v-model="showDialog"
		max-width="600px"
		persistent
		@keydown.esc="closeDialog"
	>
		<v-card>
			<v-card-title>
				{{ task ? 'Edit Task' : parentTask ? 'Nueva subtarea' : 'New Task' }}
			</v-card-title>
			<v-card-text>
				<v-form ref="formRef" lazy-validation>
					<v-text-field
						autofocus
						v-model="formData.description"
						label="Description*"
						:rules="requiredRules"
						required
					/>
					<v-combobox
						v-model="formData.project"
						:items="projects"
						hide-selected
						label="Project"
					/>
					<v-autocomplete
						v-model="formData.webparent"
						:items="parentOptions"
						item-text="description"
						item-value="uuid"
						label="Tarea principal"
						hint="Opcional. Deja el campo vacío para que sea una tarea independiente."
						persistent-hint
						clearable
						:disabled="recur"
					/>
					<v-combobox
						v-model="formData.tags"
						:items="tags"
						hide-selected
						small-chips
						multiple
						label="Tags"
						hint="Press tab or enter to add new tags"
					/>
					<v-row>
						<v-col cols="12" sm="6" class="py-0">
							<task-date-field
								v-model="formData.due"
								:label="recur ? 'Vencimiento*' : 'Vencimiento'"
								:rules="recur ? requiredRules : []"
								:required="recur"
							/>
						</v-col>
						<v-col cols="12" sm="6" class="py-0">
							<task-date-field v-model="formData.until" label="Repetir hasta" />
						</v-col>
						<v-col cols="12" sm="6" class="py-0">
							<task-date-field v-model="formData.scheduled" label="Programada" />
						</v-col>
						<v-col cols="12" sm="6" class="py-0">
							<task-date-field v-model="formData.wait" label="Esperar hasta" />
						</v-col>
					</v-row>
					<v-row class="px-3">
						<v-checkbox v-model="recur" class="mr-3" label="Recur" :disabled="!!formData.webparent" />
						<v-text-field
							label="period*"
							v-model="formData.recur"
							:rules="recur ? requiredRules : []"
							:required="recur"
							:disabled="!recur"
						/>
					</v-row>
					<v-radio-group v-model="formData.priority" row hide-details class="align-center">
						<template v-slot:prepend>
							<span class="mr-3 subtitle-1">
								Priority
							</span>
						</template>
						<v-radio
							v-for="p in priorities"
							:key="p.text"
							:label="p.text"
							:value="p.value"
						/>
					</v-radio-group>

					<v-list subheader dense flat>
						<v-subheader>Annotations</v-subheader>
						<v-list-item>
							<v-list-item-content>
								<v-text-field
									placeholder="Annotation text"
									v-model="addAnnotationDescription"
								/>
							</v-list-item-content>
							<v-list-item-action>
								<v-btn
									class="primary ml-1"
									fab
									dark
									x-small
									title="Add annotation"
									@click="addAnnotation"
								>
									<v-icon>mdi-plus</v-icon>
								</v-btn>
							</v-list-item-action>
						</v-list-item>
						<v-list-item v-for="a in formData.annotations" :key="a.entry">
							<v-list-item-content>
								<v-list-item-title v-text="a.description" class="text-wrap"></v-list-item-title>
								<v-list-item-subtitle v-text="a.entry"></v-list-item-subtitle>
							</v-list-item-content>
						</v-list-item>
					</v-list>
				</v-form>
			</v-card-text>

			<v-card-actions>
				<v-spacer />
				<v-btn text @click="closeDialog" width="80px">
					Cancel
				</v-btn>
				<v-btn @click="reset" width="80px">
					Reset
				</v-btn>
				<v-btn color="primary" @click="submit" width="80px">
					Submit
				</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script lang="ts">
import { defineComponent, useStore, watch, computed, ref } from '@nuxtjs/composition-api';
import { Task } from 'taskwarrior-lib';
import { accessorType  } from "../store";
import { TreeTask, descendantsOf } from '../utils/hierarchy';

export default defineComponent({
	props: {
		value: Boolean,
		parentTask: { type: Object as () => TreeTask, required: false },
		task: {
			type: Object as () => TreeTask,
			required: false
		}
	},
	setup(props, ctx) {
		const store = useStore<typeof accessorType>();

		const projects = computed(() => store.getters.projects);
		const tags = computed(() => store.getters.tags);
		const parentOptions = computed(() => {
			const all = store.state.tasks as TreeTask[];
			const excluded = new Set(props.task ? [props.task.uuid,
				...descendantsOf(props.task, all).map(task => task.uuid)] : []);
			return all.filter(task => !excluded.has(task.uuid) &&
				(task.uuid === props.task?.webparent || (task.status !== 'deleted' &&
					task.status !== 'recurring' && !task.recur)));
		});

		const showDialog = computed({
			get: () => props.value,
			set: val => ctx.emit('input', val)
		});

		const requiredRules = [
			(str: string) => Boolean(str) || 'Required'
		];

		const addAnnotationDescription = ref('');

		const recur = ref(Boolean(props.task?.recur));
		const formData = ref({
			description: '',
			project: props.parentTask?.project || '',
			webparent: props.parentTask?.uuid || '',
			scheduled: '',
			due: '',
			until: '',
			wait: '',
			tags: [] as string[],
			annotations: [] as {entry: string; description: string}[],
			priority: 'N',
			recur: '',
			...props.task
		});

		const reset = () => {
			formData.value = {
				description: '',
				project: props.parentTask?.project || '',
				webparent: props.parentTask?.uuid || '',
				scheduled: '',
				due: '',
				until: '',
				wait: '',
				tags: [] as string[],
				annotations: [] as {entry: string; description: string}[],
				priority: 'N',
				recur: '',
				...props.task
			};
			recur.value = Boolean(props.task?.recur);
			if (formRef.value) {
				(formRef.value as any).resetValidation();
			}

			addAnnotationDescription.value = "";
		};

		watch(() => [props.task, props.parentTask, props.value], () => {
			reset();
		});

		const formRef = ref(null);

		const addAnnotation = () => {
			formData.value.annotations.push({
				entry: new Date().toISOString(),
				description: addAnnotationDescription.value
			});

			addAnnotationDescription.value = "";
		};

		const closeDialog = () => {
			showDialog.value = false;
			reset();
		};
		const submit = async () => {
			const valid = (formRef.value as any).validate();
			if (valid) {
				try {
				await store.dispatch('updateTasks', [{
					...formData.value,
					annotations: formData.value.annotations || [],
					project: formData.value.project || undefined,
					webparent: formData.value.webparent || undefined,
					scheduled: formData.value.scheduled || undefined,
					due: formData.value.due || undefined,
					until: formData.value.until || undefined,
					wait: formData.value.wait || undefined,
					priority: formData.value.priority === 'N' ? undefined : formData.value.priority,
					recur: recur.value ? formData.value.recur : undefined
				}]);
				}
				catch {
					// Error already notified by the store
					return;
				}
				store.commit('setNotification', {
					color: 'success',
					text: `Successfully ${props.task ? 'update' : 'create'} the task`
				});
				closeDialog();
			}
		};

		const priorities = [
			{ text: 'None', value: 'N' },
			{ text: 'Low', value: 'L' },
			{ text: 'Medium', value: 'M' },
			{ text: 'High', value: 'H' }
		];

		return {
			requiredRules,
			formRef,
			tags,
			projects,
			parentOptions,
			priorities,
			recur,
			formData,
			addAnnotationDescription,
			addAnnotation,
			closeDialog,
			reset,
			submit,
			showDialog
		};
	}
});
</script>
