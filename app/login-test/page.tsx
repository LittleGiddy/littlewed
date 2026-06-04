export default function LoginTest() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <form
        method="post"
        action="/api/auth/callback/credentials?callbackUrl=/dashboard"
        className="bg-white p-6 rounded shadow-md w-96"
      >
        <input
          name="email"
          type="email"
          placeholder="Email"
          className="w-full p-2 border rounded mb-2"
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
          Login
        </button>
      </form>
    </div>
  );
}