const { listenObject } = require('./listen-object');

describe('listenObject', () => {
  let mockCallback;
  let targetObject;
  let proxy;

  beforeEach(() => {
    mockCallback = jest.fn();
    targetObject = { a: 1, b: 2 };
    proxy = listenObject(targetObject, mockCallback);
  });

  it('should call callback on "get" operation', () => {
    const value = proxy.a;
    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(value).toBe(1);
  });

  it('should call callback on "set" operation', () => {
    proxy.a = 10;
    expect(mockCallback).toHaveBeenCalled();
    expect(targetObject.a).toBe(10);
  });

  it('should call callback on "has" operation', () => {
    const hasProp = 'a' in proxy;
    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(hasProp).toBe(true);
  });

  it('should call callback on "deleteProperty" operation', () => {
    delete proxy.a;
    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect('a' in targetObject).toBe(false);
  });

  it('should return correct value for Map get method', () => {
    const map = new Map([['key1', 'value1']]);
    const proxyMap = listenObject(map, mockCallback);
    
    const result = proxyMap.get('key1');
    expect(mockCallback).toHaveBeenCalled();
    expect(result).toBe('value1');
  });

	describe('when given nested object', () => {

		it('should return correct value for Map get method', () => {
			const map = {data: new Map([['key1', 'value1']])};
			const proxyMap = listenObject(map, mockCallback);
			
			const result = proxyMap.data.get('key1');
			expect(mockCallback).toHaveBeenCalled();
			expect(result).toBe('value1');
		});

		it('should return correct value for Map get method', () => {
			const map = {data: undefined};
			const proxyMap = listenObject(map, mockCallback);
			map.data = new Map();
			map.data.set('foo', 'bar');
			
			const result = proxyMap.data.get('foo');
			expect(mockCallback).toHaveBeenCalled();
			expect(result).toBe('bar');
		});

	});

  it('should call callback on "defineProperty"', () => {
    Object.defineProperty(proxy, 'c', {
      value: 3,
      writable: true,
    });
    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(proxy.c).toBe(3);
  });

  it('should call callback on "setPrototypeOf"', () => {
    const proto = { d: 4 };
    Object.setPrototypeOf(proxy, proto);
    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(Object.getPrototypeOf(proxy)).toBe(proto);
  });

  it('should call callback on "getOwnPropertyDescriptor"', () => {
    const descriptor = Object.getOwnPropertyDescriptor(proxy, 'a');
    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(descriptor.value).toBe(1);
  });
});