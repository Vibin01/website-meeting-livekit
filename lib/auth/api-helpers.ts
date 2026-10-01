import { cookies } from 'next/headers';
import 'server-only';

export const getRequest = async (url: string) => {
  try {
    const result = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    }).then((data) => data.json());
    console.log("get Data:", result)
    return result;
  } catch (error) {
    console.log(error);
  }
};

export const sendRequestReturnRaw = async (url: string, data: object) => {
  try {
    const result = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });
    console.log("Send Login Request:", result)
    return result;
  } catch (error) {
    console.log(error);
  }
};

export const phoenixFetch = async (url: string, options: RequestInit = {}) => {
  const cookieStore = await cookies();

  const phoenixCookieName = '_connect_ec_backend_key';
  const authCookie = cookieStore.get(phoenixCookieName);

  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');

  if (authCookie) {
    headers.set('Cookie', `${authCookie.name}=${authCookie.value}`);
  } else {
    const allCookies = cookieStore.getAll();
    if (allCookies.length > 0) {
      const cookieStr = allCookies.map((c) => `${c.name}=${c.value}`).join('; ');
      headers.set('Cookie', cookieStr);
    }
  }

  return fetch(url, {
    ...options,
    headers,
  });
};

