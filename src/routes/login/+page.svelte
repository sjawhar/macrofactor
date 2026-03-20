<script lang="ts">
  import { auth } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';

  let email = $state('');
  let password = $state('');
  let submitting = $state(false);
  let errorMsg = $state('');

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!email || !password) return;
    submitting = true;
    errorMsg = '';
    try {
      await auth.login(email, password);
      goto('/');
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Login failed';
    } finally {
      submitting = false;
    }
  }
</script>

<div class="login-page">
  <form class="login-card" onsubmit={handleSubmit}>
    <div class="login-logo">
      <span class="logo-text">Macro</span><span class="logo-accent">Factor</span>
    </div>
    <p class="login-subtitle">Sign in to your account</p>

    {#if errorMsg}
      <div class="message message-error">{errorMsg}</div>
    {/if}

    <div class="field">
      <label for="email">Email</label>
      <input
        id="email"
        type="email"
        bind:value={email}
        placeholder="you@example.com"
        autocomplete="email"
        required
      />
    </div>

    <div class="field">
      <label for="password">Password</label>
      <input
        id="password"
        type="password"
        bind:value={password}
        placeholder="••••••••"
        autocomplete="current-password"
        required
      />
    </div>

    <button type="submit" class="btn btn-primary btn-lg login-btn" disabled={submitting || !email || !password}>
      {#if submitting}
        <div class="spinner" style="width:18px;height:18px;border-width:2px;"></div>
        Signing in…
      {:else}
        Sign In
      {/if}
    </button>
  </form>
</div>

<style>
  .login-page {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    background: var(--color-bg);
    padding: var(--space-4);
  }

  .login-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-10);
    width: 100%;
    max-width: 420px;
  }

  .login-logo {
    font-size: var(--font-size-3xl);
    font-weight: var(--font-bold);
    text-align: center;
    margin-bottom: var(--space-2);
  }

  .logo-text {
    color: var(--color-text);
  }

  .logo-accent {
    color: var(--color-text-secondary);
  }

  .login-subtitle {
    text-align: center;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    margin-bottom: var(--space-8);
  }

  .field {
    margin-bottom: var(--space-5);
  }

  .field label {
    display: block;
    font-size: var(--font-size-sm);
    font-weight: var(--font-medium);
    color: var(--color-text-secondary);
    margin-bottom: var(--space-2);
  }

  .login-btn {
    width: 100%;
    margin-top: var(--space-4);
  }
</style>
