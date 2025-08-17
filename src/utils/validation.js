/**
 * 건국대 글로컬캠퍼스 이메일(@kku.ac.kr)인지 검증
 */
function isSchoolEmail(email) {
  return /^[A-Za-z0-9._%+-]+@kku\.ac\.kr$/.test(email);
}

module.exports = { isSchoolEmail };
