export default function ConfirmPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="card p-10 max-w-md w-full text-center">
        <p className="text-5xl mb-4">📧</p>
        <h1 className="text-2xl font-black text-gray-900 mb-2">
          ელ. ფოსტა დაადასტურეთ
        </h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          გამოგიგზავნეთ დადასტურების ბმული. გადადით ელ. ფოსტაზე და დააჭირეთ ბმულს.
        </p>
        <p className="text-xs text-gray-400 mt-4">
          ვერ იპოვეთ? შეამოწმეთ Spam საქაღალდე.
        </p>
      </div>
    </div>
  );
}