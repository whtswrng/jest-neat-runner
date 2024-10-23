const React = require("react");
const { deepClone } = require("./utils");

function App() {
  const obj = {foo: 'bar'}

  return (
    <div>
      <p>Object looks like this: {JSON.stringify(deepClone(obj))}</p>
    </div>
  );
}

module.exports = App;
