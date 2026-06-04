export default function UploadTestSimple() {
  return (
    <div className="p-8">
      <h1 className="text-xl mb-4">Simple Upload Test</h1>
      <form action="/api/upload-base-card" method="POST" encType="multipart/form-data">
        <input type="file" name="image" accept="image/*" required className="mb-2 block" />
        <input type="text" name="eventId" placeholder="Event ID" required className="mb-2 block border p-1" />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Upload</button>
      </form>
    </div>
  );
}