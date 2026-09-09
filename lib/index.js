/**
 * Node (host) half of the tab status dot plugin.
 *
 * Pure client-side plugin: the empty `apply` exists only so the plugin
 * appears in the host cordis.yml / Loader tree; the browser half ships via
 * exports["./client"], discovered through the package.json `dsh.client`
 * declaration (same convention as @deepseek-ai/dsh-client-ui-skill).
 */
export function apply() {}
