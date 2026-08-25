import { API_PATHS } from "./apiPath";
import axiosInstance from "./axiosInstance";
import { validateImageUpload } from "./imageUploadValidation";

const uploadProof = async (imageFile, userId) => {
  const validationError = validateImageUpload(imageFile);
  if (validationError) throw new Error(validationError);
  const formData = new FormData();

  formData.append("userId", userId);
  formData.append("image", imageFile);

  try {
    const response = await axiosInstance.post(
      API_PATHS.IMAGE.UPLOAD_PROOF,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      },
    );
    return response.data;
  } catch (error) {
    console.error("Proof image upload failed.");
    throw error;
  }
};

export default uploadProof;
