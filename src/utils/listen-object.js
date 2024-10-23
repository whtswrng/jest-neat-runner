function listenObject(loadedModule, cb) {
	// if(loadedModule instanceof Map) {
	// 	cb();
	// 	return loadedModule;
	// }

  const proxy = new Proxy(loadedModule, {
    get(target, prop, receiver) {
      cb();
			if (target instanceof Map && prop === "get") {
        return target.get.bind(target);
      }
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
      cb();
      return Reflect.set(target, prop, value, receiver);
    },
    has(target, prop) {
      cb();
      return Reflect.has(target, prop);
    },
    deleteProperty(target, prop) {
      cb();
      return Reflect.deleteProperty(target, prop);
    },
    apply(target, thisArg, argumentsList) {
      cb();
      return Reflect.apply(target, thisArg, argumentsList);
    },
    construct(target, args, newTarget) {
      cb();
      return Reflect.construct(target, args, newTarget);
    },
    defineProperty(target, prop, descriptor) {
      cb();
      return Reflect.defineProperty(target, prop, descriptor);
    },
    setPrototypeOf(target, proto) {
      cb();
      return Reflect.setPrototypeOf(target, proto);
    },
    getOwnPropertyDescriptor(target, prop) {
      cb();
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  });
  return proxy;
}

module.exports = {
  listenObject,
};
