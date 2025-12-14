import React from "react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import Footer from "./components/Footer";

const LandingPage = () => {
  return (
    <div className='min-h-screen'>
      <Header />
      <Hero />
      <Footer />
    </div>
  );
};

export default LandingPage;
