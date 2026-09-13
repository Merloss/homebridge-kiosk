export function Toast({ message }) {
  return (
    <div className={`toast${message ? ' visible' : ''}`} id="toast" hidden={!message}>
      {message}
    </div>
  );
}
