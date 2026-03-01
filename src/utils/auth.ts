export const setCookie = (name: string, value: string, days: number = 7) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires.toUTCString()};path=/;SameSite=Lax`;
};

export const getCookie = (name: string): string | null => {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
    return null;
};

export const removeCookie = (name: string) => {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
};

export interface UserData {
    firstName: string;
    lastName: string;
    role: string;
    userId: string;
    token: string;
    picture: string;
}

export const AUTH_COOKIE_NAME = 'adcropper_auth';

export const saveAuth = (data: UserData) => {
    setCookie(AUTH_COOKIE_NAME, JSON.stringify(data));
};

export const getAuth = (): UserData | null => {
    const data = getCookie(AUTH_COOKIE_NAME);
    if (!data) return null;
    try {
        return JSON.parse(data);
    } catch (e) {
        return null;
    }
};

export const logout = () => {
    removeCookie(AUTH_COOKIE_NAME);
};
