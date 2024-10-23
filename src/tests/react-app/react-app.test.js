const React = require("react");
const { render, screen } = require("@testing-library/react");
const App = require("./app");
require("@testing-library/jest-dom");

test("renders the date and sum correctly", () => {
  render(<App />);

  const dateElement = screen.getByText(/Object looks like this/i);
  expect(dateElement).toBeInTheDocument();
});
