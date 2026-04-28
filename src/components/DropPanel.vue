<script lang="ts" setup>
import DropField from '@/components/DropField.vue';

const emit = defineEmits(['files-dropped'])

function onChange(event: Event) {
  if (event.target === null) { console.error("Event target is null"); return }
  const target = (event.target as HTMLInputElement)
  if (target.files === null) { console.error("target.files is null"); return }
  emit('files-dropped', target.files)
}

function reEmit(payload: FileList) {
  emit('files-dropped', payload)
}

</script>
<template>
  <DropField @files-dropped="reEmit">
    <slot for="input"></slot>
    <input id="input" type="file" multiple class="hideinput" @change="onChange">
  </DropField>
</template>
<style scoped>
.hideinput {
  opacity: 0;
  position: absolute !important;
  width: 1px !important;
  height: 1px !important;
  padding: 0 !important;
  margin: -1px !important;
  overflow: hidden !important;
  clip: rect(0, 0, 0, 0) !important;
  white-space: nowrap !important;
  border: 0 !important;
}
</style>
