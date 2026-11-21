// Share one queue between services that update related collections.
function createOperationQueue() {
  let tail = Promise.resolve();
  return (operation) => {
    const result = tail.then(operation, operation);
    tail = result.catch(() => {});
    return result;
  };
}

module.exports = { createOperationQueue };
