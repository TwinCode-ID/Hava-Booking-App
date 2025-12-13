import { motion } from "framer-motion";
import { Search, ArrowRight, Users, ShieldCheck, Vault } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";

const Hero = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const stats = [
    { icon: Users, label: "Active Students", value: "500+" },
    { icon: ShieldCheck, label: "Certified Instructors", value: "25+" },
  ];

  return (
    <section className="pt-24 pb-16 bg-white min-h-screen  flex items-center">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          {/* Main Heading */}

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight pt-10"
          >
            Book your class now!
            <br />
            <motion.span
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-emerald-800 mb-6 leading-tight pt-10"
            >
              And feel the magic.
            </motion.span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2, duration: 1.2 }}
            className="text-xl md:text-xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            Connect with your strongest self through expert-led training.
            <br />
            Your total body transformation is just one click away.
          </motion.p>

          {/* CTA Buttons */}

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.6, duration: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group bg-emerald-900 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-emerald-800 transition-all duration-300 shadow-lg hover:shadow-xl flex items-center space-x-2"
              onClick={() => navigate("/book-now")}
            >
              <span>Get Started</span>
              <ArrowRight className="" />
            </motion.button>
          </motion.div>

          {/* Stats */}

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.0, duration: 0.8 }}
            className="grid grid-cols-2 gap-4 max-w-2xl mx-auto"
          >
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 + index * 0.1, duration: 0.6 }}
                className="flex flex-col items-center space-y-2 p-4 rounded-xl"
              >
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-2">
                  <stat.icon className="w-6 h-6 text-emerald-800" />
                </div>
                <div className="text-2xl font-bold text-emerald-700">
                  {stat.value}
                </div>
                <div className="text-sm text-gray-600 font-medium">
                  {stat.label}
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
