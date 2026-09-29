<!-- examples/svelte.svelte — minimal Svelte usage. Install: npm i @chomuiro/saisei -->
<!-- In layout/load: import "@chomuiro/saisei/dist/blueprint.css"; -->
<script>
  import { onMount } from "svelte";
  import { theme, initTheme, toggle } from "@chomuiro/saisei/adapters/svelte.js";

  let open = false;
  onMount(initTheme);
</script>

<main class="container">
  <button class="btn btn-secondary btn-sm mono" on:click={toggle}>
    ⇄ {$theme === "dark" ? "Light" : "Dark"}
  </button>
  <div class="card reg-corners">
    <span class="card-tag">// CARD-01</span>
    <h3 class="card-title">Project Atlas</h3>
    <button class="btn btn-primary" on:click={() => (open = true)}>Open modal</button>
  </div>
  {#if open}
    <div class="modal-overlay is-open">
      <div class="modal" role="dialog" aria-modal="true" aria-label="Demo">
        <p class="text-soft text-sm">Svelte owns the state; the kit owns the look.</p>
        <div class="modal-footer">
          <button class="btn btn-secondary" on:click={() => (open = false)}>Close</button>
        </div>
      </div>
    </div>
  {/if}
</main>
