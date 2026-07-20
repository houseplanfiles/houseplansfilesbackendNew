const mongoose = require("mongoose");
const dotenv = require("dotenv");
const connectDB = require("../config/db");
const Lead = require("../models/leadModel");

dotenv.config();
connectDB();

const seedLeads = async () => {
  try {
    // Optional: Clear existing leads
    await Lead.deleteMany();

    const mockLeads = [
      {
        title: "Need Architect for 30x50 Duplex House Plan",
        category: "Architect",
        city: "Jaipur",
        budget: "₹25,000",
        requirements: "Looking for an experienced architect to create a modern duplex house plan. Need 2D layout, 3D front elevation, and structure drawings. Plot size is 30x50 feet facing east.",
        price: 199,
        clientName: "Rakesh Sharma",
        clientPhone: "9876543210",
        clientEmail: "rakesh.jaipur@example.com",
        status: "Available",
      },
      {
        title: "Civil Contractor for Full House Construction (Turnkey)",
        category: "Contractor",
        city: "Lucknow",
        budget: "₹45 Lakhs",
        requirements: "Need a reliable civil contractor for a turnkey construction of a G+1 floor residential building. Material specifications will be provided. Construction area is approx 2200 sq ft.",
        price: 499,
        clientName: "Amit Verma",
        clientPhone: "9123456789",
        clientEmail: "amit.verma@example.com",
        status: "Available",
      },
      {
        title: "Interior Designer for 3 BHK Apartment",
        category: "Interior Designer",
        city: "Bhopal",
        budget: "₹8 Lakhs",
        requirements: "Looking for an interior designer for modular kitchen, wardrobe, TV unit, and false ceiling styling for a newly built 3 BHK flat. Premium finish required.",
        price: 299,
        clientName: "Sanjay Patel",
        clientPhone: "9988776655",
        clientEmail: "sanjay.patel@example.com",
        status: "Available",
      },
      {
        title: "Electrical Contractor for Commercial Showroom",
        category: "Electrical Contractor",
        city: "Delhi",
        budget: "₹1.5 Lakhs",
        requirements: "Wiring, DB installation, and decorative lighting installation for a clothing store showroom of 1200 sq ft area. Work needs to be completed within 10 days.",
        price: 149,
        clientName: "Kapil Dev",
        clientPhone: "8877665544",
        clientEmail: "kapil.dev@example.com",
        status: "Available",
      },
      {
        title: "Swimming Pool Installation Contractor",
        category: "Swimming Pool Contractor",
        city: "Indore",
        budget: "₹6 Lakhs",
        requirements: "Construction of a concrete swimming pool in the backyard of a villa. Size 15x30 feet, depth 4 to 6 feet with filtration plant installation.",
        price: 349,
        clientName: "Rahul Singh",
        clientPhone: "7766554433",
        clientEmail: "rahul.singh@example.com",
        status: "Available",
      },
    ];

    await Lead.insertMany(mockLeads);
    console.log("Mock leads seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding leads:", error);
    process.exit(1);
  }
};

seedLeads();
