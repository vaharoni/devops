export type HelloWorldInput = {
  message: string;
};

export function sayHello(opts: HelloWorldInput) {
  return `Hello, ${opts.message}!`;
}
