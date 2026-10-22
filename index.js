/**
 * Host half of the session-groups bundle.
 *
 * Groups are a browser-local view over Workspace and Session state, so the
 * Host half has no service, tool, or event to register. The Web client loads
 * `client.js` from the package's `dsh.client` manifest and replaces the
 * `sidebar.workspaces` occupant there.
 */

export const name = 'session-groups';

/** No Host service is required for this browser-only feature. */
export function apply() {}
