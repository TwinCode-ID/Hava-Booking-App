const toAuthenticatedUser = (user) => {
  const {
    password,
    authenticators,
    currentChallenge,
    ...safeUser
  } = user;

  return {
    ...safeUser,
    hasPassword: Boolean(password),
  };
};

module.exports = { toAuthenticatedUser };
