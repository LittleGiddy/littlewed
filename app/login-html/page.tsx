export default function LoginHtml() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <form
        method="post"
        action="/api/auth/callback/credentials?callbackUrl=/client/dashboard"
        className="bg-white p-8 rounded shadow-md w-96"
      >
        <h1 className="text-2xl font-bold text-center mb-6">Little Wed</h1>
        <input
          name="email"
          type="email"
          placeholder="Email"
          className="w-full p-2 border rounded mb-3"
          required
        />
        <input
          name="password"
          type="password"
          placeholder="Password"
          className="w-full p-2 border rounded mb-4"
          required
        />
        <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">
          Sign In
        </button>
      </form>
    </div>
  );
}