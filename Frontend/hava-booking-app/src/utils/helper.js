//Validate Email
export const validateEmail = (email) => {
  if (!email.trim()) return "Email is required";
  const emailRegex = /^[^\s@]+@[^\s@]+\.+[^\s@]+$/;
  if (!emailRegex.test(email)) return "Please enter a valid email address";
  return "";
};

//Validate Password
export const validatePassword = (password) => {
  if (!password) return "password is required";
  if (password.length < 8) return "Password must be at least 8 characters";
  if (!/(?=.*[a-z])/.test(password))
    return "Password must be at least one lowercase letter";
  if (!/(?=.*[A-Z])/.test(password))
    return "Password must be at least one uppercase letter";
  if (!/(?=.*\d)/.test(password))
    return "Password must contain at least one number";
  return "";
};

// Validate Phone Number
export const validatePhoneNumber = (phone) => {
  if (!phone) return "Phone number is required";

  // Check for valid characters (numbers, spaces, dashes, plus sign, parentheses)
  if (!/^[0-9+\-\s()]*$/.test(phone)) {
    return "Phone number contains invalid characters";
  }

  // Count actual digits to check length
  const digits = phone.replace(/\D/g, ""); // Remove everything except numbers

  if (digits.length < 10) {
    return "Phone number must be at least 10 digits";
  }

  if (digits.length > 15) {
    return "Phone number is too long";
  }

  return "";
};

//Validate Avatar
export const validateAvatar = (file) => {
  if (!file) return ""; // Avatar is optional

  const allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/x-png",
    "image/pjpeg",
  ];
  if (!allowedTypes.includes(file.type)) {
    return "Avatar must be a JPG or PNG file";
  }

  const maxSize = 5 * 1024 * 1024; // 5mb
  if (file.size > maxSize) {
    return "Avatar must be less than 5mb";
  }
};
