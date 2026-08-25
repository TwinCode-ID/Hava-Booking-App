const toAuthenticatedUser = (user) => {
  const {
    password,
    authenticators,
    currentChallenge,
    currentChallengeExpiresAt,
    currentChallengeType,
    authVersion,
    passwordChangedAt,
    ...safeUser
  } = user;

  return {
    ...safeUser,
    hasPassword: Boolean(password),
  };
};

module.exports = { toAuthenticatedUser };
