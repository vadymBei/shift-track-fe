import {environment} from '../../../environments/environment';

/** Gateway address, set per build configuration in src/environments. */
export const API_HOST = environment.apiHost;
export const API_BASE_URL = `${API_HOST}/api/shift-track/`;
export const NOTIFICATIONS_HUB_URL = `${API_HOST}/hubs/shift-track/notifications`;
