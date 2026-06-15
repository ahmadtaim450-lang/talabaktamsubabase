export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      // ===== التحقق من هوية الأدمن عبر توكن Firebase =====
      const authHeader = request.headers.get('Authorization') || '';
      const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (!idToken) {
        return jsonResponse({ error: 'Unauthorized: missing token' }, 401);
      }
      const verified = await verifyFirebaseToken(idToken, env.FIREBASE_API_KEY);
      if (!verified) {
        return jsonResponse({ error: 'Unauthorized: invalid token' }, 401);
      }

      const { public_id } = await request.json();
      if (!public_id) return jsonResponse({ error: 'Missing public_id' }, 400);

      const timestamp = Math.floor(Date.now() / 1000);
      const signature = await generateSignature(public_id, timestamp, env.CLOUDINARY_API_SECRET);

      const formData = new FormData();
      formData.append('public_id', public_id);
      formData.append('timestamp', timestamp);
      formData.append('api_key', env.CLOUDINARY_API_KEY);
      formData.append('signature', signature);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/destroy`,
        { method: 'POST', body: formData }
      );

      const result = await res.json();
      return jsonResponse(result, 200);
    } catch (e) {
      return jsonResponse({ error: e.message }, 500);
    }
  }
};

// يتحقق من صلاحية توكن Firebase. بما أن إنشاء الحسابات (sign-up) معطّل،
// فأي مستخدم صالح في المشروع هو أدمن.
async function verifyFirebaseToken(idToken, apiKey) {
  if (!apiKey) return false;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      }
    );
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data.users) && data.users.length > 0;
  } catch (e) {
    return false;
  }
}

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

async function generateSignature(publicId, timestamp, secret) {
  const str = `public_id=${publicId}&timestamp=${timestamp}${secret}`;
  const msgBuffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
