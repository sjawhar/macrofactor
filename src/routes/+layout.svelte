<script lang="ts">
  import '../app.css';
  import { auth } from '$lib/stores/auth.svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/state';

  let { children } = $props();

  let restored = $state(false);

  $effect(() => {
    auth.restore().then(() => {
      restored = true;
    });
  });

  $effect(() => {
    if (!restored) return;
    const path = page.url.pathname;
    if (!auth.isAuthenticated && path !== '/login') {
      goto('/login');
    }
  });

  const navItems = [
    { href: '/', label: 'Dashboard', icon: 'home' },
    { href: '/food-log', label: 'Food Log', icon: 'utensils' },
    { href: '/search', label: 'Search', icon: 'search' },
    { href: '/weight', label: 'Weight', icon: 'scale' },
    { href: '/strategy', label: 'Strategy', icon: 'target' },
    { href: '/expenditure', label: 'Expenditure', icon: 'activity' },
    { href: '/nutrition', label: 'Nutrition', icon: 'bar-chart' },
    { href: '/micros', label: 'Micronutrients', icon: 'zap' },
  ] as const;

  function isActive(href: string): boolean {
    if (href === '/') return page.url.pathname === '/';
    return page.url.pathname.startsWith(href);
  }

  function handleLogout() {
    auth.logout();
    goto('/login');
  }
</script>

{#if !restored}
  <div class="loading-screen">
    <div class="spinner spinner-lg"></div>
  </div>
{:else if page.url.pathname === '/login'}
  {@render children()}
{:else if auth.isAuthenticated}
  <div class="app-shell">
    <nav class="sidebar">
      <div class="sidebar-logo">
        <span class="logo-text">Macro</span><span class="logo-accent">Factor</span>
      </div>

      <ul class="nav-list">
        {#each navItems as item}
          <li>
            <a
              href={item.href}
              class="nav-item"
              class:active={isActive(item.href)}
            >
              <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                {#if item.icon === 'home'}
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                {:else if item.icon === 'utensils'}
                  <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 002-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 00-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
                {:else if item.icon === 'search'}
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                {:else if item.icon === 'scale'}
                  <path d="M16.5 2H7.5a2 2 0 00-2 2v1H2v3h3v1a7 7 0 1014 0V8h3V5h-3.5V4a2 2 0 00-2-2z"/>
                {:else if item.icon === 'target'}
                  <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
                {:else if item.icon === 'bar-chart'}
                  <line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>
                {:else if item.icon === 'activity'}
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                {:else if item.icon === 'zap'}
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  <line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>
                {/if}
              </svg>
              <span>{item.label}</span>
            </a>
          </li>
        {/each}
      </ul>

      <div class="sidebar-footer">
        <button class="nav-item logout-btn" onclick={handleLogout}>
          <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          <span>Log Out</span>
        </button>
      </div>
    </nav>

    <main class="main-content">
      {@render children()}
    </main>
  </div>
{/if}

<style>
  .loading-screen {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: var(--color-bg);
  }

  .app-shell {
    display: flex;
    min-height: 100vh;
  }

  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: var(--sidebar-width);
    background: var(--color-surface);
    border-right: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    padding: var(--space-6) 0;
    z-index: 100;
  }

  .sidebar-logo {
    padding: 0 var(--space-6);
    margin-bottom: var(--space-8);
    font-size: var(--font-size-xl);
    font-weight: var(--font-bold);
  }

  .logo-text {
    color: var(--color-text);
  }

  .logo-accent {
    color: var(--color-text-secondary);
  }

  .nav-list {
    list-style: none;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: 0 var(--space-3);
  }

  .nav-item {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: var(--space-3) var(--space-4);
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    text-decoration: none;
    font-size: var(--font-size-sm);
    font-weight: var(--font-medium);
    transition: background var(--transition-fast), color var(--transition-fast);
  }

  .nav-item:hover {
    background: var(--color-surface-elevated);
    color: var(--color-text);
    text-decoration: none;
  }

  .nav-item.active {
    background: rgba(255, 255, 255, 0.08);
    color: var(--color-text);
  }

  .nav-icon {
    width: 20px;
    height: 20px;
    flex-shrink: 0;
  }

  .sidebar-footer {
    padding: 0 var(--space-3);
    border-top: 1px solid var(--color-border);
    padding-top: var(--space-4);
    margin-top: var(--space-4);
  }

  .logout-btn {
    width: 100%;
    text-align: left;
    color: var(--color-text-tertiary);
  }

  .logout-btn:hover {
    color: var(--color-error);
    background: rgba(255, 59, 48, 0.1);
  }

  .main-content {
    margin-left: var(--sidebar-width);
    flex: 1;
    padding: var(--space-8);
    max-width: 1200px;
  }
</style>
