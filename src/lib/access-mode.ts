import settings from "../../dashboard-access.json";

export const PUBLIC_DASHBOARD = settings.public_dashboard === true;
export const ADMIN_LOGIN_URL = PUBLIC_DASHBOARD ? "/login?admin=1" : "/login";
