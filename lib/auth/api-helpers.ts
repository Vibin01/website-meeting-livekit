import { cookies } from 'next/headers';
import 'server-only';

export const getRequest = async (url: string) => {
  try {
    const result = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    }).then((data) => data.json());

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

    return result;
  } catch (error) {
    console.log(error);
  }
};

export const sendRequest = async (url: string, data: object) => {
  try {
    const result = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(data),
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    }).then((data) => data.json());

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
  }

  return fetch(url, {
    ...options,
    headers,
  });
};
