'use server';

import { cookies } from 'next/headers';
import { getRequest, sendRequestReturnRaw } from '@/lib/auth/api-helpers';
import { encrypt } from '@/lib/auth/auth-helpers';

export type UserType = 'Candidate' | 'Recruiter' | 'Panel' | 'candidate' | 'recruiter' | 'panel';

export interface LoginPayload {
  contact: string;
  password: string;
  id: string;
  user_type: string;
}

export interface LoginParams {
  contact: string;
  password: string;
  user_type: string;
}

export interface LoginResult {
  success: boolean;
  payload?: LoginPayload;
  data?: unknown;
  error?: string;
}

const COOKIE_NAME = '_connect_ec_backend_key';

export async function login(params: LoginParams | FormData): Promise<LoginResult> {
  try {
    let contact = '';
    let password = '';
    let user_type = '';

    if (params instanceof FormData) {
      contact = (params.get('contact') as string) || '';
      password = (params.get('password') as string) || '';
      user_type = (params.get('user_type') as string) || '';
    } else {
      contact = params.contact || '';
      password = params.password || '';
      user_type = params.user_type || '';
    }

    // 1. Validate inputs
    if (!contact.trim()) {
      return {
        success: false,
        error: 'Please enter your Valid Email',
      };
    }

    if (!password) {
      return {
        success: false,
        error: 'Please enter your password.',
      };
    }

    // 2. Retrieve single-use nonce
    const nonceRes = await getRequest('https://uat.api.connectec.app/api/getnonce');
    const nonceData = nonceRes?.data;

    if (!nonceData?.nonce || !nonceData?.id) {
      return {
        success: false,
        error: 'Failed to retrieve nonce from server.',
      };
    }

    // 3. Encrypt password using nonce
    const encryptedPassword = encrypt(password, nonceData.nonce);

    // 4. Construct payload
    const payload: LoginPayload = {
      contact: contact.trim(),
      password: encryptedPassword,
      id: nonceData.id,
      user_type: user_type.toLowerCase(),
    };

    // 5. Send login request to backend
    const loginResponse = await sendRequestReturnRaw(
      'https://uat.api.connectec.app/api/login',
      payload
    );

    if (!loginResponse) {
      return {
        success: false,
        error: 'No response from authentication server.',
      };
    }

    const resData = await loginResponse.json().catch(() => null);

    // 6. Check login status condition
    if (resData?.status === 'success') {
      // Capture and set cookie from response headers
      const setCookies =
        typeof loginResponse.headers.getSetCookie === 'function'
          ? loginResponse.headers.getSetCookie()
          : ([loginResponse.headers.get('set-cookie')].filter(Boolean) as string[]);

      const cookieStore = await cookies();

      for (const rawCookie of setCookies) {
        if (!rawCookie) continue;
        const [cookiePart] = rawCookie.split(';');
        const [name, ...valParts] = cookiePart.split('=');
        const cookieName = name?.trim();
        const cookieValue = valParts.join('=').trim();

        if (cookieName) {
          cookieStore.set(cookieName, cookieValue, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 2592000, // 30 days
          });
        }
      }
      
      return {
        success: true,
        payload,
        data: resData,
      };
    } else {
      const errorMsg =
        resData?.message ||
        (resData?.errors
          ? typeof resData.errors === 'string'
            ? resData.errors
            : Object.values(resData.errors).join(', ')
          : 'Login failed. Please check your credentials.');

      return {
        success: false,
        error: errorMsg,
      };
    }
  } catch (error: unknown) {
    console.error('Login action error:', error);
    const msg = error instanceof Error ? error.message : 'Error processing login request';
    return {
      success: false,
      error: msg,
    };
  }
}

