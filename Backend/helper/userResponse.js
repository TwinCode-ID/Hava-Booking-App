const toAuthenticatedUser = (user) => {
  const { password, ...safeUser } = user;

  return {
    ...safeUser,
    hasPassword: Boolean(password),
  };
};

module.exports = { toAuthenticatedUser };
