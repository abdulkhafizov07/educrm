'use client';
import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// The Users list now lives at /users/students and /users/staff (see Sidebar submenu).
// This route stays around as a redirect so old links (e.g. /users?edit=<id>) keep working.
function UsersRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const edit = searchParams.get('edit');
    router.replace(edit ? `/users/students?edit=${edit}` : '/users/students');
  }, [router, searchParams]);

  return null;
}

// useSearchParams() must sit inside a Suspense boundary, otherwise `next build`
// fails while prerendering (missing-suspense-with-csr-bailout).
export default function UsersRedirectPage() {
  return (
    <Suspense fallback={null}>
      <UsersRedirect />
    </Suspense>
  );
}
