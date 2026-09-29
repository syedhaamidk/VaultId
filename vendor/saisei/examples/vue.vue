<!-- examples/vue.vue — minimal Vue usage. Install: npm i @chomuiro/saisei -->
<!-- In main.js: import "@chomuiro/saisei/dist/blueprint.css"; -->
<template>
  <main class="container">
    <button class="btn btn-secondary btn-sm mono" @click="toggle">
      ⇄ {{ theme === "dark" ? "Light" : "Dark" }}
    </button>
    <div class="card reg-corners">
      <span class="card-tag">// CARD-01</span>
      <h3 class="card-title">Project Atlas</h3>
      <button class="btn btn-primary" @click="open = true">Open modal</button>
    </div>
    <div v-if="open" class="modal-overlay is-open">
      <div class="modal" role="dialog" aria-modal="true" aria-label="Demo">
        <p class="text-soft text-sm">Vue owns the state; the kit owns the look.</p>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="open = false">Close</button>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup>
import { ref } from "vue";
import { useBlueprintTheme } from "@chomuiro/saisei/adapters/vue.js";
const { theme, toggle } = useBlueprintTheme();
const open = ref(false);
</script>
