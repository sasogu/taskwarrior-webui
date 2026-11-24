<template>
	<div class="task-annotations">
		<v-list subheader dense flat>
			<v-subheader>{{ $t('Annotations') }}</v-subheader>
			<p class="caption px-4" role="status">
				{{ $t(editingIndex === null ? 'Annotation changes are applied when you save the task.' : 'Save or cancel the annotation edit before saving the task.') }}
			</p>
			<v-list-item>
				<v-list-item-content>
					<v-textarea v-model="newText" :label="$t('Annotation text')"
						rows="1" auto-grow :disabled="editingIndex !== null" />
				</v-list-item-content>
				<v-list-item-action>
					<v-btn class="primary ml-1" fab dark x-small :title="$t('Add annotation')"
						:aria-label="$t('Add annotation')" :disabled="!newText.trim() || editingIndex !== null" @click="add">
						<v-icon>mdi-plus</v-icon>
					</v-btn>
				</v-list-item-action>
			</v-list-item>
			<v-list-item v-for="(annotation, index) in value" :key="index" class="annotation-row">
				<v-list-item-content>
					<template v-if="editingIndex === index">
						<v-textarea v-model="editText" :label="$t('Edit annotation')" auto-grow rows="2"
							@keydown.esc.stop="cancelEdit" />
						<div class="d-flex flex-wrap">
							<v-btn small text @click="cancelEdit">{{ $t('Cancel editing') }}</v-btn>
							<v-btn small color="primary" :disabled="!editText.trim()" @click="saveEdit">{{ $t('Save annotation') }}</v-btn>
						</div>
					</template>
					<div v-else class="annotation-description">
						<template v-for="(part, partIndex) in annotationParts(annotation.description)">
							<a v-if="part.url" :key="partIndex" :href="part.url" target="_blank" rel="noopener noreferrer">{{ part.text }}</a>
							<span v-else :key="partIndex">{{ part.text }}</span>
						</template>
					</div>
					<v-list-item-subtitle>{{ formatTaskDate(annotation.entry, $language) }}</v-list-item-subtitle>
				</v-list-item-content>
				<v-list-item-action v-if="editingIndex !== index" class="annotation-actions">
					<v-btn icon small :title="$t('Edit annotation')" :aria-label="$t('Edit annotation')"
						:disabled="editingIndex !== null" @click="edit(index)"><v-icon small>mdi-pencil</v-icon></v-btn>
					<v-btn icon small :title="$t('Delete annotation')" :aria-label="$t('Delete annotation')"
						:disabled="editingIndex !== null" @click="pendingDelete = index"><v-icon small>mdi-delete</v-icon></v-btn>
				</v-list-item-action>
			</v-list-item>
		</v-list>
		<v-dialog :value="pendingDelete !== null" max-width="480px" persistent @keydown.esc.stop="pendingDelete = null">
			<v-card>
				<v-card-title>{{ $t('Delete annotation') }}</v-card-title>
				<v-card-text>
					<p>{{ $t('Delete this annotation?') }}</p>
					<div class="annotation-description">{{ pendingDelete === null ? '' : value[pendingDelete].description }}</div>
				</v-card-text>
				<v-card-actions>
					<v-spacer />
					<v-btn text @click="pendingDelete = null">{{ $t('Cancel') }}</v-btn>
					<v-btn text color="error" @click="remove">{{ $t('Delete annotation') }}</v-btn>
				</v-card-actions>
			</v-card>
		</v-dialog>
	</div>
</template>

<script lang="ts">
import { defineComponent, ref } from '@nuxtjs/composition-api';
import { formatTaskDate } from '../utils/dates';

type Annotation = { entry: string; description: string };
type AnnotationPart = { text: string; url?: string };

function annotationParts(description: string): AnnotationPart[] {
	const parts: AnnotationPart[] = [];
	const urls = /https?:\/\/[^\s<>"']+/g;
	let start = 0;
	let match: RegExpExecArray | null;
	while ((match = urls.exec(description)) !== null) {
		if (match.index > start) parts.push({ text: description.slice(start, match.index) });
		const url = match[0].replace(/[.,;:!?)]*$/, '');
		parts.push({ text: url, url });
		start = match.index + url.length;
		urls.lastIndex = start;
	}
	if (start < description.length) parts.push({ text: description.slice(start) });
	return parts;
}

export default defineComponent({
	props: {
		value: { type: Array as () => Annotation[], default: () => [] }
	},
	setup(props, { emit }) {
		const newText = ref('');
		const editingIndex = ref<number | null>(null);
		const editText = ref('');
		const pendingDelete = ref<number | null>(null);
		const cancelEdit = () => {
			editingIndex.value = null;
			editText.value = '';
			emit('editing', false);
		};
		const add = () => {
			if (!newText.value.trim() || editingIndex.value !== null) return;
			emit('input', [...props.value, { entry: new Date().toISOString(), description: newText.value }]);
			newText.value = '';
		};
		const edit = (index: number) => {
			editingIndex.value = index;
			editText.value = props.value[index].description;
			emit('editing', true);
		};
		const saveEdit = () => {
			if (editingIndex.value === null || !editText.value.trim()) return;
			emit('input', props.value.map((annotation, index) => index === editingIndex.value
				? { ...annotation, description: editText.value } : annotation));
			cancelEdit();
		};
		const remove = () => {
			if (pendingDelete.value === null) return;
			emit('input', props.value.filter((_annotation, index) => index !== pendingDelete.value));
			pendingDelete.value = null;
		};
		return { newText, editingIndex, editText, pendingDelete, add, edit, saveEdit, cancelEdit, remove, formatTaskDate, annotationParts };
	}
});
</script>

<style scoped>
.annotation-description { white-space: pre-wrap; overflow-wrap: anywhere; }
.annotation-description a {
	display: block;
	width: fit-content;
	max-width: 100%;
	min-height: 44px;
	box-sizing: border-box;
	padding: 10px 12px;
	margin: 6px 0 10px;
	border-radius: 8px;
	background: rgba(127, 127, 127, 0.12);
}
.annotation-actions { flex-direction: row; align-self: center; }
</style>
