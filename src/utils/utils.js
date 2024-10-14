function simpleHash(str) {
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }

  const fileName = str.split("/").pop();

  return hash.toString() + "_" + fileName;
}


module.exports ={
    simpleHash
}