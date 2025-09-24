import React, { useEffect, useRef, useState } from "react";
import {
  Mail,
  Phone,
  Linkedin,
  Github,
  MapPin,
  Code,
  Database,
  Cloud,
  Award,
  Calendar,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import defaultProfile from "./assets/profile.jpg"; // <- your bundled image

/* ======================= IndexedDB helpers (Blob storage) ======================= */
const DB_NAME = "portfolio-db";
const DB_STORE = "photos";
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function idbDelete(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/* =================== Image resize/compress → Blob (for IDB) ==================== */
async function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

function drawToCanvas(img, maxSize = 768) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  let { width, height } = img;

  // keep aspect ratio while bounding by maxSize
  if (width > height) {
    if (width > maxSize) {
      height = Math.round((height * maxSize) / width);
      width = maxSize;
    }
  } else {
    if (height > maxSize) {
      width = Math.round((width * maxSize) / height);
      height = maxSize;
    }
  }
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
}

function canvasToBlob(canvas, type = "image/jpeg", quality = 0.85) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function compressFileToBlob(file) {
  const img = await fileToImage(file);
  const canvas = drawToCanvas(img, 768);
  const blob = await canvasToBlob(canvas, "image/jpeg", 0.85);
  return blob;
}

/* ================================= Component ================================= */
const Portfolio = () => {
  const [activeSection, setActiveSection] = useState("hero");
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Contact form
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("");

  // Profile photo: start with defaultProfile; override with IDB if present
  const [profilePicUrl, setProfilePicUrl] = useState(defaultProfile);
  const [photoError, setPhotoError] = useState("");
  const fileInputRef = useRef(null);
  const lastObjectUrlRef = useRef(null); // tracks object URL we create for IDB blobs (not the import)

  // Load saved photo (if any) from IndexedDB on mount
  useEffect(() => {
    (async () => {
      try {
        const blob = await idbGet("profilePic");
        if (blob) {
          const url = URL.createObjectURL(blob);
          if (lastObjectUrlRef.current)
            URL.revokeObjectURL(lastObjectUrlRef.current);
          lastObjectUrlRef.current = url;
          setProfilePicUrl(url); // override the default bundled image
        }
      } catch {
        setPhotoError("Couldn't load saved photo.");
      }
    })();
    // cleanup object URL on unmount
    return () => {
      if (lastObjectUrlRef.current)
        URL.revokeObjectURL(lastObjectUrlRef.current);
    };
  }, []);

  // Pick & save new photo
  async function handlePhotoPick(file) {
    setPhotoError("");
    try {
      const blob = await compressFileToBlob(file); // resized & compressed
      await idbSet("profilePic", blob); // store in IndexedDB
      const url = URL.createObjectURL(blob);
      if (lastObjectUrlRef.current)
        URL.revokeObjectURL(lastObjectUrlRef.current);
      lastObjectUrlRef.current = url;
      setProfilePicUrl(url); // show it
    } catch (e) {
      console.error(e);
      setPhotoError(
        "Failed to save image. Try another image (preferably under ~5MB)."
      );
    }
  }

  async function removePhoto() {
    try {
      await idbDelete("profilePic");
    } catch {}
    if (lastObjectUrlRef.current) {
      URL.revokeObjectURL(lastObjectUrlRef.current);
      lastObjectUrlRef.current = null;
    }
    setProfilePicUrl(defaultProfile); // fall back to bundled image
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus("");

    try {
      const res = await fetch("http://localhost:4000/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data?.message || "Failed to send");
      }

      setSubmitStatus("success");
      setFormData({ name: "", email: "", subject: "", message: "" });
    } catch (err) {
      console.error(err);
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Scroll spy
  useEffect(() => {
    const onScroll = () => {
      const sections = [
        "hero",
        "about",
        "experience",
        "projects",
        "skills",
        "education",
        "certifications",
        "contact",
      ];
      const y = window.scrollY + 100;
      for (const id of sections) {
        const el = document.getElementById(id);
        if (!el) continue;
        const { offsetTop, offsetHeight } = el;
        if (y >= offsetTop && y < offsetTop + offsetHeight) {
          setActiveSection(id);
          break;
        }
      }
    };
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      setIsMenuOpen(false);
    }
  };

  const navItems = [
    { id: "hero", label: "Home" },
    { id: "about", label: "About" },
    { id: "experience", label: "Experience" },
    { id: "projects", label: "Projects" },
    { id: "skills", label: "Skills" },
    { id: "education", label: "Education" },
    { id: "contact", label: "Contact" },
  ];

  const experiences = [
    {
      title: "Software Engineer Intern – Developer",
      company: "VJMSOL",
      period: "July 2024 – July 2025",
      description:
        "Leading frontend module development with React.js, Tailwind CSS, and Redux Toolkit, ensuring cross-browser compatibility and accessibility.",
      achievements: [
        "Implemented JWT authentication and session handling",
        "Created UML sequence diagrams for technical documentation",
        "Built CI/CD pipelines with AWS CodePipeline",
        "Incorporated automated unit testing",
      ],
    },
    {
      title: "Intern – Developer",
      company: "Qonsult Business Solutions",
      period: "Feb 2024 – June 2024",
      description:
        "Built reusable React.js components and optimized REST APIs in Node.js/Express, improving performance and reducing latency.",
      achievements: [
        "Configured GitLab CI pipelines and Docker containers",
        "Automated builds, deployments, and regression tests",
        "Participated in UML diagrams and technical specification reviews",
        "Ensured code quality and SDLC adherence",
      ],
    },
    {
      title: "Intern – Web Developer",
      company: "Flair Agile Technologies",
      period: "May 2023 – July 2023",
      description:
        "Collaborated in Agile sprints to design and implement responsive web interfaces using React.js, Node.js, and JavaScript.",
      achievements: [
        "Improved UI engagement by 20%",
        "Developed automated unit tests",
        "Integrated GitHub Actions CI/CD pipelines",
        "Participated in peer code reviews",
      ],
    },
  ];

  const projects = [
    {
      title: "Hired – Smart University Job Portal",
      period: "Jan 2025 – Apr 2025",
      description:
        "Architected a cloud-native portal connecting 1,000+ students and 50+ recruiters",
      tech: [
        "React.js",
        "Node.js",
        "Express.js",
        "MongoDB",
        "AWS EC2",
        "S3",
        "Lambda",
      ],
      achievements: [
        "Developed secure REST APIs with comprehensive unit testing",
        "Performance tuned Lambda-based microservices",
        "Ensured scalable, fault-tolerant operations",
      ],
      github: "https://github.com/shanthan15/HiRed",
    },

    {
      title: "MediLink – Telemedicine & Appointment Platform",
      period: "Oct 2024 – Dec 2024",
      description:
        "End-to-end healthcare web app for booking appointments, consulting doctors, and managing e-prescriptions.",
      tech: [
        "React.js",
        "Node.js",
        "Express.js",
        "MongoDB",
        "JWT",
        "AWS EC2",
        "S3",
      ],
      achievements: [
        "Implemented role-based authentication for patients, doctors, and admins",
        "Built appointment scheduling with calendar conflicts & reminders",
        "Added e-prescription generation and secure file storage on S3",
        "Set up CI/CD with AWS CodePipeline and automated tests",
      ],
      github: "https://github.com/shanthan15/medilink",
    },
    {
      title: "DalScooter – Serverless Scooter Sharing on AWS",
      period: "Mar 2024 – May 2024",
      description:
        "Campus scooter rental platform built entirely on AWS with a serverless architecture and global CDN.",
      tech: [
        "React.js",
        "AWS Amplify",
        "Amazon Cognito",
        "Amazon API Gateway",
        "AWS Lambda (Node.js)",
        "Amazon DynamoDB",
        "Amazon Location Service",
        "AWS IoT Core",
        "Amazon S3",
        "Amazon CloudFront",
        "Amazon CloudWatch",
        "Amazon SNS",
        "AWS Step Functions",
      ],
      achievements: [
        "Designed a serverless backend using API Gateway + Lambda + DynamoDB with Cognito auth (users/admins) and fine-grained RBAC.",
        "Implemented live scooter tracking & geofencing via Amazon Location Service and IoT Core; trip billing orchestrated with Step Functions and computed in Lambda.",
        "Deployed the React app on S3 + CloudFront with CI/CD via Amplify; added CloudWatch metrics/alarms and SNS notifications for operational alerts.",
      ],
      github: "https://github.com/shanthan15/DalScooter",
    },
    {
      title: "Gramothan – Rural Development Web App",
      period: "Jun 2024 – Sep 2024",
      description:
        "Community platform for NGOs and SHGs with e-commerce and job modules",
      tech: ["HTML5", "CSS3", "JavaScript", "Node.js", "MySQL"],
      achievements: [
        "Reduced page load times by 25% through optimization",
        "Created UML database schema diagrams",
        "Collaborated in Agile sprints across teams",
      ],
      github: "https://github.com/shanthan15/Gramothan",
    },
  ];

  const skillCategories = [
    {
      title: "Programming Languages",
      skills: ["C", "C++", "Java", "Python", "JavaScript", "PHP"],
      icon: <Code className="w-6 h-6" />,
    },
    {
      title: "Web & Mobile Technologies",
      skills: ["HTML", "CSS", "Node.js", "React.js", "Express.js"],
      icon: <Code className="w-6 h-6" />,
    },
    {
      title: "Databases",
      skills: ["MySQL", "MongoDB", "Hadoop ecosystem concepts"],
      icon: <Database className="w-6 h-6" />,
    },
    {
      title: "Cloud Services",
      skills: ["AWS EC2", "S3", "Lambda", "Azure fundamentals"],
      icon: <Cloud className="w-6 h-6" />,
    },
  ];

  const certifications = [
    "Full Stack Web Development Certification (LinkedIn Learning)",
    "C and C++ Programming Certification (Udemy)",
    "Java Programming Certification (Udemy)",
    "Switching, Routing, and Wireless Essentials Certification (Cisco)",
    "Cloud Operations Certification (AWS)",
    "Machine Learning Foundations Certification (AWS)",
    "RPA Developer Foundation Certification (UiPath)",
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-sm shadow-sm z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="text-2xl font-bold text-blue-600">
              Shanthan Reddy Nandhi
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex space-x-8">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`text-sm font-medium transition-colors hover:text-blue-600 ${
                    activeSection === item.id
                      ? "text-blue-600"
                      : "text-gray-600"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-md text-gray-600 hover:text-blue-600"
            >
              {isMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>

          {/* Mobile Navigation */}
          {isMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-200">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className="block w-full text-left py-2 text-sm font-medium text-gray-600 hover:text-blue-600"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>
      {/* Hero Section */}
      <section
        id="hero"
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 pt-20 relative overflow-hidden"
      >
        {/* Background Graphics */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-indigo-400/20 to-blue-400/20 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-blue-400/10 to-purple-400/10 rounded-full blur-3xl"></div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left side - Text content */}
            <div className="text-center lg:text-left order-2 lg:order-1">
              <div className="animate-fade-in">
                <div className="inline-flex items-center bg-blue-100/50 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                  <span className="text-sm font-medium text-blue-800">
                    Available for opportunities
                  </span>
                </div>
                <h1 className="text-4xl sm:text-6xl font-bold text-gray-900 mb-6 leading-tight">
                  Hi, I'm{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">
                    Shanthan Reddy Nandhi
                  </span>
                </h1>
                <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                  Full-Stack Developer passionate about building scalable,
                  responsive applications using modern cloud technologies
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start items-center mb-8">
                  <div className="flex items-center text-gray-600 bg-white/50 backdrop-blur-sm rounded-lg px-4 py-2">
                    <MapPin className="w-4 h-4 mr-2 text-blue-600" />
                    Halifax, Nova Scotia
                  </div>
                  <div className="flex items-center text-gray-600 bg-white/50 backdrop-blur-sm rounded-lg px-4 py-2">
                    <Mail className="w-4 h-4 mr-2 text-blue-600" />
                    Available
                  </div>
                </div>
                <div className="flex justify-center lg:justify-start space-x-4 mb-8">
                  <a
                    href="mailto:shanthan678@gmail.com"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
                  >
                    Get In Touch
                  </a>
                  <a
                    href="#projects"
                    onClick={() => scrollToSection("projects")}
                    className="bg-white/80 backdrop-blur-sm hover:bg-white text-gray-800 px-6 py-3 rounded-lg font-medium transition-all border border-gray-200 hover:border-blue-300"
                  >
                    View Work
                  </a>
                </div>
                <div className="flex justify-center lg:justify-start space-x-6">
                  <a
                    href="mailto:shanthan678@gmail.com"
                    className="text-gray-600 hover:text-blue-600 transition-colors transform hover:scale-110"
                  >
                    <Mail className="w-6 h-6" />
                  </a>
                  <a
                    href="https://linkedin.com/in/shanthan-reddy-nandhi-8bb862144"
                    className="text-gray-600 hover:text-blue-600 transition-colors transform hover:scale-110"
                  >
                    <Linkedin className="w-6 h-6" />
                  </a>
                  <a
                    href="https://github.com/shanthan15"
                    target="_blank"
                    rel="noreferrer"
                    className="text-gray-600 hover:text-blue-600 transition-colors transform hover:scale-110"
                  >
                    <Github className="w-6 h-6" />
                  </a>
                </div>
              </div>
            </div>

            {/* Right side - Profile picture and graphics */}
            <div className="flex justify-center lg:justify-end order-1 lg:order-2">
              <div className="relative">
                {/* Decorative elements */}
                <div className="absolute -inset-4 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full opacity-20 blur-lg animate-pulse"></div>
                <div
                  className="absolute -top-4 -right-4 w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-400 rounded-full opacity-80 animate-bounce"
                  style={{ animationDelay: "1s" }}
                ></div>
                <div
                  className="absolute -bottom-6 -left-6 w-16 h-16 bg-gradient-to-br from-green-400 to-blue-400 rounded-full opacity-80 animate-bounce"
                  style={{ animationDelay: "2s" }}
                ></div>

                {/* ===== Profile picture container (fills the big circle) ===== */}
                <div className="relative w-80 h-80 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full p-2 shadow-2xl">
                  <div className="relative w-full h-full rounded-full overflow-hidden group">
                    {/* Hidden file input (optional upload to replace default) */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files && e.target.files[0];
                        if (file) handlePhotoPick(file);
                      }}
                    />
                    {/* Image / Placeholder fills the circle */}
                    {profilePicUrl ? (
                      <img
                        src={profilePicUrl}
                        alt="Profile"
                        className="w-full h-full object-cover"
                        draggable={false}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center">
                        <span className="text-white text-6xl font-bold select-none">
                          SR
                        </span>
                      </div>
                    )}
                    // (Removed hover overlay and "Change Photo" text)
                  </div>

                  {/* Actions / error under circle */}
                  <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
                    {profilePicUrl !== defaultProfile ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removePhoto();
                        }}
                        className="text-xs text-red-600 hover:text-red-700 underline"
                      >
                        Remove photo
                      </button>
                    ) : (
                      <p className="text-xs text-gray-600 mt-2"></p>
                    )}
                    {photoError && (
                      <p className="text-xs text-red-600 mt-2">{photoError}</p>
                    )}
                  </div>
                </div>

                {/* Floating tech icons */}
                <div className="absolute top-8 right-8 w-12 h-12 bg-white rounded-lg shadow-lg flex items-center justify-center animate-float">
                  <Code className="w-6 h-6 text-blue-600" />
                </div>
                <div
                  className="absolute top-32 -right-6 w-12 h-12 bg-white rounded-lg shadow-lg flex items-center justify-center animate-float"
                  style={{ animationDelay: "0.5s" }}
                >
                  <Database className="w-6 h-6 text-green-600" />
                </div>
                <div
                  className="absolute bottom-32 -left-8 w-12 h-12 bg-white rounded-lg shadow-lg flex items-center justify-center animate-float"
                  style={{ animationDelay: "1s" }}
                >
                  <Cloud className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-center">
            <button
              onClick={() => scrollToSection("about")}
              className="text-blue-600 hover:text-blue-800 transition-colors animate-bounce"
            >
              <ChevronDown className="w-8 h-8" />
            </button>
          </div>
        </div>
      </section>
      {/* About Section */}
      <section id="about" className="py-20 bg-white relative overflow-hidden">
        {/* Background accents */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-100/50 to-transparent rounded-full -translate-y-32 translate-x-32"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-purple-100/50 to-transparent rounded-full translate-y-32 -translate-x-32"></div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              About Me
            </h2>
            <div className="w-20 h-1 bg-gradient-to-r from-blue-600 to-purple-600 mx-auto"></div>
          </div>
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <p className="text-lg text-gray-600 leading-relaxed mb-6">
                  I'm a passionate full-stack developer with a strong foundation
                  in computer science and hands-on experience across the entire
                  Software Development Life Cycle. Currently pursuing my Masters
                  in Applied Computer Science at Dalhousie University, I bring
                  expertise in building responsive, scalable applications and
                  developing robust APIs.
                </p>
                <p className="text-lg text-gray-600 leading-relaxed mb-8">
                  My experience spans cloud-native development using AWS
                  services, modern frontend frameworks like React.js, backend
                  platforms including Node.js and Express, and both relational
                  and non-relational databases. I'm passionate about
                  collaboration, adaptability, and applying leadership acumen in
                  dynamic environments.
                </p>

                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
                    <div className="text-3xl font-bold text-blue-600 mb-2">
                      2+
                    </div>
                    <div className="text-sm text-gray-600 font-medium">
                      Years Experience
                    </div>
                  </div>
                  <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
                    <div className="text-3xl font-bold text-purple-600 mb-2">
                      5+
                    </div>
                    <div className="text-sm text-gray-600 font-medium">
                      Projects Completed
                    </div>
                  </div>
                </div>
              </div>

              {/* Tech Stack Visualization */}
              <div className="relative">
                <div className="relative w-full h-80 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-6 shadow-xl overflow-hidden">
                  <div className="text-center mb-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">
                      My Tech Stack
                    </h4>
                    <div className="w-12 h-1 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto"></div>
                  </div>

                  <div className="relative w-40 h-40 mx-auto">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-white font-bold text-sm">DEV</span>
                    </div>

                    <div
                      className="absolute inset-0 animate-spin"
                      style={{ animationDuration: "20s" }}
                    >
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shadow-md">
                        <span className="text-white text-xs font-bold">R</span>
                      </div>
                      <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center shadow-md">
                        <span className="text-white text-xs font-bold">N</span>
                      </div>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center shadow-md">
                        <span className="text-white text-xs font-bold">A</span>
                      </div>
                      <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center shadow-md">
                        <span className="text-white text-xs font-bold">D</span>
                      </div>
                    </div>

                    <div
                      className="absolute inset-4 animate-spin"
                      style={{
                        animationDuration: "15s",
                        animationDirection: "reverse",
                      }}
                    >
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-indigo-400 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">J</span>
                      </div>
                      <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-red-400 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">P</span>
                      </div>
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">C</span>
                      </div>
                      <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 bg-pink-400 rounded-full flex items-center justify-center">
                        <span className="text-white text-xs font-bold">M</span>
                      </div>
                    </div>
                  </div>

                  <div className="absolute bottom-4 left-0 right-0">
                    <div className="flex justify-center space-x-4 text-xs text-gray-600">
                      <span className="bg-blue-100 px-2 py-1 rounded">
                        React
                      </span>
                      <span className="bg-green-100 px-2 py-1 rounded">
                        Node.js
                      </span>
                      <span className="bg-orange-100 px-2 py-1 rounded">
                        AWS
                      </span>
                      <span className="bg-purple-100 px-2 py-1 rounded">
                        MongoDB
                      </span>
                    </div>
                  </div>

                  <div className="absolute -top-4 -right-4 w-12 h-12 bg-gradient-to-br from-green-400 to-green-600 rounded-lg shadow-lg flex items-center justify-center animate-pulse">
                    <Cloud className="w-5 h-5 text-white" />
                  </div>
                  <div className="absolute -bottom-4 -left-4 w-10 h-10 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg shadow-lg flex items-center justify-center animate-pulse">
                    <Database className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
              <div className="text-center p-8 bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl transform hover:scale-105 transition-transform">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Code className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Full-Stack Development
                </h3>
                <p className="text-gray-600">
                  Experienced in both frontend and backend technologies
                </p>
              </div>
              <div className="text-center p-8 bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl transform hover:scale-105 transition-transform">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Cloud className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Cloud Technologies
                </h3>
                <p className="text-gray-600">
                  Proficient in AWS services and cloud-native development
                </p>
              </div>
              <div className="text-center p-8 bg-gradient-to-br from-green-50 to-green-100 rounded-2xl transform hover:scale-105 transition-transform">
                <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                  <Database className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Database Management
                </h3>
                <p className="text-gray-600">
                  Experience with both SQL and NoSQL databases
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Experience Section */}
      <section
        id="experience"
        className="py-20 bg-gray-50 relative overflow-hidden"
      >
        {/* Background Graphics */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 -right-32 w-64 h-64 bg-gradient-to-bl from-blue-100/30 to-transparent rounded-full"></div>
          <div className="absolute bottom-1/3 -left-32 w-80 h-80 bg-gradient-to-tr from-purple-100/20 to-transparent rounded-full"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-indigo-50/10 to-blue-50/10 rounded-full"></div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Professional Experience
            </h2>
            <div className="w-20 h-1 bg-gradient-to-r from-blue-600 to-purple-600 mx-auto mb-6"></div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              My professional journey spanning multiple roles where I've
              developed expertise in full-stack development and cloud
              technologies.
            </p>
          </div>

          {/* Timeline Container */}
          <div className="relative">
            {/* Timeline Line */}
            <div
              className="hidden lg:block absolute left-1/2 transform -translate-x-1/2 w-1 bg-gradient-to-b from-blue-200 via-purple-200 to-indigo-200 rounded-full"
              style={{ height: "calc(100% - 4rem)" }}
            ></div>

            <div className="space-y-16">
              {experiences.map((exp, index) => (
                <div
                  key={index}
                  className={`group relative ${
                    index % 2 === 0 ? "lg:flex-row" : "lg:flex-row-reverse"
                  } flex flex-col lg:flex items-center`}
                >
                  {/* Timeline Node (Desktop) */}
                  <div className="hidden lg:block absolute left-1/2 transform -translate-x-1/2 w-16 h-16 z-10">
                    <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 rounded-full shadow-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-bold text-sm">
                          {index + 1}
                        </span>
                      </div>
                    </div>
                    {/* Pulse animation */}
                    <div className="absolute inset-0 w-16 h-16 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full animate-ping opacity-20"></div>
                  </div>

                  {/* Experience Card */}
                  <div
                    className={`lg:w-5/12 ${
                      index % 2 === 0 ? "lg:pr-16" : "lg:pl-16"
                    } w-full`}
                  >
                    <div className="bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all transform hover:-translate-y-2 p-8 border border-gray-100 relative overflow-hidden group">
                      {/* Card Background Graphics */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-50 to-transparent rounded-full -translate-y-16 translate-x-16 opacity-50"></div>
                      <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-purple-50 to-transparent rounded-full translate-y-12 -translate-x-12 opacity-50"></div>

                      {/* Company Logo/Icon */}
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center">
                          <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mr-4 shadow-lg group-hover:shadow-xl transition-shadow">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                              <Code className="w-5 h-5 text-white" />
                            </div>
                          </div>
                          <div>
                            <h4 className="text-lg font-bold text-blue-600 mb-1">
                              {exp.company}
                            </h4>
                            <div className="flex items-center text-gray-500 text-sm">
                              <Calendar className="w-4 h-4 mr-2" />
                              {exp.period}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="relative z-10">
                        <h3 className="text-xl font-bold text-gray-900 mb-4 group-hover:text-blue-600 transition-colors">
                          {exp.title}
                        </h3>
                        <p className="text-gray-600 mb-6 leading-relaxed">
                          {exp.description}
                        </p>
                        {/* Key Achievements with Icons */}
                        <div className="space-y-3">
                          <h5 className="text-sm font-semibold text-gray-800 mb-3 flex items-center">
                            <Award className="w-4 h-4 mr-2 text-blue-500" />
                            Key Achievements
                          </h5>
                          {exp.achievements.map((achievement, idx) => (
                            <div
                              key={idx}
                              className="flex items-start group/achievement"
                            >
                              <div className="w-6 h-6 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center mr-3 flex-shrink-0 group-hover/achievement:scale-110 transition-transform">
                                <div className="w-2 h-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full"></div>
                              </div>
                              <p className="text-gray-600 text-sm leading-relaxed group-hover/achievement:text-gray-800 transition-colors">
                                {achievement}
                              </p>
                            </div>
                          ))}
                        </div>
                        {/* Skills Used (if you want to add this data) */}
                        <div className="mt-6 pt-4 border-t border-gray-100">
                          <div className="flex flex-wrap gap-2">
                            {/* Sample skills - you can make this dynamic by adding skills to your experience data */}
                            {index === 0 && (
                              <>
                                <span className="px-3 py-1 bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700 rounded-full text-xs font-medium">
                                  React.js
                                </span>
                                <span className="px-3 py-1 bg-gradient-to-r from-green-100 to-green-200 text-green-700 rounded-full text-xs font-medium">
                                  AWS
                                </span>
                                <span className="px-3 py-1 bg-gradient-to-r from-purple-100 to-purple-200 text-purple-700 rounded-full text-xs font-medium">
                                  Node.js
                                </span>
                              </>
                            )}
                            {index === 1 && (
                              <>
                                <span className="px-3 py-1 bg-gradient-to-r from-orange-100 to-orange-200 text-orange-700 rounded-full text-xs font-medium">
                                  GitLab CI
                                </span>
                                <span className="px-3 py-1 bg-gradient-to-r from-indigo-100 to-indigo-200 text-indigo-700 rounded-full text-xs font-medium">
                                  Docker
                                </span>
                                <span className="px-3 py-1 bg-gradient-to-r from-pink-100 to-pink-200 text-pink-700 rounded-full text-xs font-medium">
                                  Express.js
                                </span>
                              </>
                            )}
                            {index === 2 && (
                              <>
                                <span className="px-3 py-1 bg-gradient-to-r from-teal-100 to-teal-200 text-teal-700 rounded-full text-xs font-medium">
                                  GitHub Actions
                                </span>
                                <span className="px-3 py-1 bg-gradient-to-r from-red-100 to-red-200 text-red-700 rounded-full text-xs font-medium">
                                  JavaScript
                                </span>
                                <span className="px-3 py-1 bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-700 rounded-full text-xs font-medium">
                                  Agile
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Hover gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-purple-600/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    </div>
                  </div>

                  {/* Mobile Timeline Node */}
                  <div className="lg:hidden w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full shadow-lg flex items-center justify-center mb-4 relative">
                    <span className="text-white font-bold text-sm">
                      {index + 1}
                    </span>
                    <div className="absolute inset-0 w-8 h-8 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full animate-ping opacity-20"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center mt-16">
            <div className="inline-flex items-center bg-gradient-to-r from-blue-50 to-purple-50 rounded-full px-8 py-4 border border-blue-100 shadow-lg">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-3 animate-pulse"></div>
              <span className="text-gray-700 mr-3">
                Currently seeking new opportunities
              </span>
              <a
                href="#contact"
                onClick={() => scrollToSection("contact")}
                className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-full font-medium hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-105"
              >
                Let's Connect
              </a>
            </div>
          </div>
        </div>
      </section>
      {/* Projects Section */}
      <section
        id="projects"
        className="py-20 bg-white relative overflow-hidden"
      >
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-gradient-to-bl from-blue-50/30 to-transparent rounded-full translate-x-48"></div>
        <div className="absolute bottom-1/4 left-0 w-96 h-96 bg-gradient-to-tr from-purple-50/30 to-transparent rounded-full -translate-x-48"></div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Featured Projects
            </h2>
            <div className="w-20 h-1 bg-gradient-to-r from-blue-600 to-purple-600 mx-auto"></div>
            <p className="text-lg text-gray-600 mt-6 max-w-2xl mx-auto">
              Here are some of my recent projects that showcase my skills in
              full-stack development and cloud technologies.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {projects.map((project, index) => (
              <div
                key={index}
                className="group bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl p-8 hover:shadow-2xl transition-all transform hover:-translate-y-2 border border-gray-100 relative"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center mr-4 shadow-lg">
                      <Code className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {project.title}
                    </h3>
                  </div>
                  {project.github && (
                    <a
                      href={project.github}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${project.title} on GitHub`}
                      className="text-gray-400 hover:text-blue-600 transform hover:scale-110 transition-all"
                    >
                      <Github className="w-6 h-6" />
                    </a>
                  )}
                </div>

                <div className="flex items-center text-gray-500 mb-4">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span className="text-sm font-medium">{project.period}</span>
                </div>

                <p className="text-gray-600 mb-6 leading-relaxed">
                  {project.description}
                </p>

                <div className="mb-6">
                  <div className="flex flex-wrap gap-2">
                    {project.tech.map((tech, idx) => (
                      <span
                        key={idx}
                        className="px-3 py-1 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-800 rounded-full text-sm font-medium border border-blue-200/50"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {project.achievements.map((ach, idx) => (
                    <div key={idx} className="flex items-start">
                      <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to紫-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        {ach}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-purple-600/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <div className="inline-flex items-center bg-gradient-to-r from-blue-50 to-purple-50 rounded-full px-6 py-3 border border-blue-100">
              <span className="text-gray-600 mr-2">
                Want to see more projects?
              </span>
              <a
                href="#contact"
                onClick={() => scrollToSection("contact")}
                className="text-blue-600 font-medium hover:text-blue-800 transition-colors"
              >
                Let's connect →
              </a>
            </div>
          </div>
        </div>
      </section>
      {/* Skills Section */}
      <section
        id="skills"
        className="py-20 bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30 relative overflow-hidden"
      >
        {/* Background Graphics */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 -right-32 w-96 h-96 bg-gradient-to-bl from-blue-200/20 to-transparent rounded-full"></div>
          <div className="absolute bottom-1/3 -left-32 w-80 h-80 bg-gradient-to-tr from-purple-200/20 to-transparent rounded-full"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-indigo-100/10 to-blue-100/10 rounded-full"></div>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Technical Skills
            </h2>
            <div className="w-20 h-1 bg-gradient-to-r from-blue-600 to-purple-600 mx-auto mb-6"></div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              A comprehensive overview of my technical expertise across various
              domains
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {skillCategories.map((category, index) => (
              <div
                key={index}
                className="group bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-2 border border-white/50 relative overflow-hidden"
              >
                {/* Card Background Graphics */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-100/30 to-transparent rounded-full -translate-y-16 translate-x-16 opacity-50 group-hover:opacity-70 transition-opacity"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-purple-100/30 to-transparent rounded-full translate-y-12 -translate-x-12 opacity-50 group-hover:opacity-70 transition-opacity"></div>

                {/* Header with animated icon */}
                <div className="flex items-center mb-8 relative z-10">
                  <div
                    className={`
                    w-16 h-16 rounded-2xl flex items-center justify-center mr-6 shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-110 group-hover:rotate-3
                    ${
                      index === 0
                        ? "bg-gradient-to-br from-blue-500 to-blue-600"
                        : ""
                    }
                    ${
                      index === 1
                        ? "bg-gradient-to-br from-green-500 to-green-600"
                        : ""
                    }
                    ${
                      index === 2
                        ? "bg-gradient-to-br from-purple-500 to-purple-600"
                        : ""
                    }
                    ${
                      index === 3
                        ? "bg-gradient-to-br from-orange-500 to-orange-600"
                        : ""
                    }
                  `}
                  >
                    <div className="text-white transform group-hover:scale-110 transition-transform">
                      {category.icon}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                      {category.title}
                    </h3>
                    <div className="w-12 h-1 bg-gradient-to-r from-blue-400 to-purple-400 mt-2 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </div>
                </div>

                {/* Skills with enhanced styling and animations */}
                <div className="flex flex-wrap gap-3 relative z-10">
                  {category.skills.map((skill, idx) => (
                    <div key={idx} className="group/skill relative">
                      <span
                        className={`
                          px-4 py-3 rounded-xl font-medium transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 cursor-default border shadow-sm hover:shadow-md
                          ${
                            index === 0
                              ? "bg-gradient-to-r from-blue-50 to-blue-100 text-blue-800 border-blue-200 hover:from-blue-100 hover:to-blue-200"
                              : ""
                          }
                          ${
                            index === 1
                              ? "bg-gradient-to-r from-green-50 to-green-100 text-green-800 border-green-200 hover:from-green-100 hover:to-green-200"
                              : ""
                          }
                          ${
                            index === 2
                              ? "bg-gradient-to-r from-purple-50 to-purple-100 text-purple-800 border-purple-200 hover:from-purple-100 hover:to-purple-200"
                              : ""
                          }
                          ${
                            index === 3
                              ? "bg-gradient-to-r from-orange-50 to-orange-100 text-orange-800 border-orange-200 hover:from-orange-100 hover:to-orange-200"
                              : ""
                          }
                        `}
                        style={{
                          animationDelay: `${idx * 100}ms`,
                        }}
                      >
                        {skill}
                      </span>

                      {/* Skill level indicator (optional visual enhancement) */}
                      <div
                        className={`
                        absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-0 h-0.5 rounded-full transition-all duration-300 group-hover/skill:w-3/4
                        ${index === 0 ? "bg-blue-500" : ""}
                        ${index === 1 ? "bg-green-500" : ""}
                        ${index === 2 ? "bg-purple-500" : ""}
                        ${index === 3 ? "bg-orange-500" : ""}
                      `}
                      ></div>
                    </div>
                  ))}
                </div>

                {/* Skill count indicator */}
                <div className="absolute top-4 right-4 opacity-30 group-hover:opacity-60 transition-opacity">
                  <div
                    className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                    ${index === 0 ? "bg-blue-100 text-blue-600" : ""}
                    ${index === 1 ? "bg-green-100 text-green-600" : ""}
                    ${index === 2 ? "bg-purple-100 text-purple-600" : ""}
                    ${index === 3 ? "bg-orange-100 text-orange-600" : ""}
                  `}
                  >
                    {category.skills.length}
                  </div>
                </div>

                {/* Hover overlay effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
              </div>
            ))}
          </div>

          {/* Additional Skills Showcase */}
          <div className="mt-16 text-center">
            <div className="inline-flex items-center bg-white/70 backdrop-blur-sm rounded-full px-8 py-4 border border-gray-200/50 shadow-lg">
              <div className="flex items-center space-x-4">
                <div className="flex -space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center border-2 border-white shadow-md">
                    <Code className="w-4 h-4 text-white" />
                  </div>
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center border-2 border-white shadow-md">
                    <Database className="w-4 h-4 text-white" />
                  </div>
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center border-2 border-white shadow-md">
                    <Cloud className="w-4 h-4 text-white" />
                  </div>
                </div>
                <span className="text-gray-700 font-medium">
                  20+ Technologies Mastered
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Education Section */}
      <section
        id="education"
        className="py-20 bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 relative overflow-hidden"
      >
        {/* Animated Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 -right-40 w-96 h-96 bg-gradient-to-bl from-blue-200/20 to-transparent rounded-full animate-pulse"></div>
          <div
            className="absolute bottom-1/3 -left-40 w-80 h-80 bg-gradient-to-tr from-indigo-200/15 to-transparent rounded-full animate-pulse"
            style={{ animationDelay: "1s" }}
          ></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-purple-100/10 to-blue-100/10 rounded-full"></div>
        </div>

        {/* Floating Academic Icons */}
        <div className="absolute top-20 left-10 w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl shadow-lg flex items-center justify-center animate-float">
          <svg
            className="w-8 h-8 text-white"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.75 2.524z" />
          </svg>
        </div>
        <div
          className="absolute top-40 right-16 w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-xl shadow-lg flex items-center justify-center animate-float"
          style={{ animationDelay: "2s" }}
        >
          <svg
            className="w-6 h-6 text-white"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div
          className="absolute bottom-32 left-20 w-14 h-14 bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-2xl shadow-lg flex items-center justify-center animate-float"
          style={{ animationDelay: "3s" }}
        >
          <svg
            className="w-7 h-7 text-white"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
          </svg>
        </div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center mb-16">
            <div className="inline-flex items-center bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full px-6 py-3 mb-6 border border-blue-200/50 shadow-sm">
              <svg
                className="w-5 h-5 text-blue-600 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z" />
              </svg>
              <span className="text-blue-800 font-medium text-sm">
                Academic Journey
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Education
            </h2>
            <div className="w-20 h-1 bg-gradient-to-r from-blue-600 to-indigo-600 mx-auto mb-6"></div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              My academic foundation in computer science, spanning both
              undergraduate and graduate studies
            </p>
          </div>

          {/* Education Timeline */}
          <div className="relative max-w-4xl mx-auto">
            {/* Timeline Line */}
            <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2 w-1 h-full bg-gradient-to-b from-blue-300 via-indigo-300 to-purple-300 rounded-full"></div>

            <div className="space-y-16">
              {/* Masters Degree */}
              <div className="group relative">
                {/* Timeline Node */}
                <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2 w-16 h-16 z-20">
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full shadow-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-blue-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z" />
                      </svg>
                    </div>
                  </div>
                  {/* Pulse Animation */}
                  <div className="absolute inset-0 w-16 h-16 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full animate-ping opacity-20"></div>
                </div>

                {/* Education Card */}
                <div className="md:w-1/2 md:pr-12 w-full">
                  <div className="group/card bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3 border border-white/50 relative overflow-hidden">
                    {/* Card Background Graphics */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-blue-500/10 to-transparent rounded-full -translate-y-16 translate-x-16"></div>
                    <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-indigo-500/10 to-transparent rounded-full translate-y-12 -translate-x-12"></div>

                    {/* University Icon and Status */}
                    <div className="flex items-start justify-between mb-6 relative z-10">
                      <div className="flex items-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl flex items-center justify-center mr-4 shadow-lg group-hover/card:shadow-xl transition-shadow border border-blue-200/50">
                          <svg
                            className="w-8 h-8 text-blue-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.75 2.524z" />
                          </svg>
                        </div>
                        <div className="flex items-center bg-gradient-to-r from-green-100 to-emerald-100 border border-green-200 rounded-full px-4 py-2 shadow-sm">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                          <span className="text-green-700 text-sm font-semibold">
                            Current
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="relative z-10">
                      <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover/card:text-blue-600 transition-colors">
                        Masters in Applied Computer Science
                      </h3>

                      <div className="flex items-center mb-4">
                        <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center mr-3">
                          <svg
                            className="w-4 h-4 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z" />
                          </svg>
                        </div>
                        <h4 className="text-xl font-semibold text-blue-600">
                          Dalhousie University
                        </h4>
                      </div>

                      <div className="flex items-center text-gray-600 mb-6">
                        <div className="w-5 h-5 bg-gradient-to-br from-gray-400 to-gray-500 rounded-lg flex items-center justify-center mr-3">
                          <Calendar className="w-3 h-3 text-white" />
                        </div>
                        <span className="font-medium">Jan 2025 – Present</span>
                      </div>

                      {/* Academic Focus Areas */}
                      <div className="space-y-3">
                        <h5 className="text-sm font-semibold text-gray-800 flex items-center">
                          <svg
                            className="w-4 h-4 text-blue-500 mr-2"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Focus Areas
                        </h5>
                        <div className="flex flex-wrap gap-2">
                          <span className="px-3 py-1 bg-gradient-to-r from-blue-100 to-blue-200 text-blue-700 rounded-full text-xs font-medium border border-blue-200/50">
                            Software Engineering
                          </span>
                          <span className="px-3 py-1 bg-gradient-to-r from-indigo-100 to-indigo-200 text-indigo-700 rounded-full text-xs font-medium border border-indigo-200/50">
                            Cloud Computing
                          </span>
                          <span className="px-3 py-1 bg-gradient-to-r from-purple-100 to-purple-200 text-purple-700 rounded-full text-xs font-medium border border-purple-200/50">
                            Data Systems
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Animated Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-indigo-600/5 rounded-3xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500"></div>
                  </div>
                </div>
              </div>

              {/* Bachelor's Degree */}
              <div className="group relative">
                {/* Timeline Node */}
                <div className="hidden md:block absolute left-1/2 transform -translate-x-1/2 w-16 h-16 z-20">
                  <div className="w-full h-full bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full shadow-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-purple-600"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                  {/* Pulse Animation */}
                  <div className="absolute inset-0 w-16 h-16 bg-gradient-to-br from-purple-400 to-indigo-500 rounded-full animate-ping opacity-20"></div>
                </div>

                {/* Education Card */}
                <div className="md:w-1/2 md:ml-auto md:pl-12 w-full">
                  <div className="group/card bg-white/90 backdrop-blur-sm rounded-3xl p-8 shadow-xl hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3 border border-white/50 relative overflow-hidden">
                    {/* Card Background Graphics */}
                    <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full -translate-y-16 -translate-x-16"></div>
                    <div className="absolute bottom-0 right-0 w-24 h-24 bg-gradient-to-tl from-indigo-500/10 to-transparent rounded-full translate-y-12 translate-x-12"></div>

                    {/* University Icon and Status */}
                    <div className="flex items-start justify-between mb-6 relative z-10">
                      <div className="flex items-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-2xl flex items-center justify-center mr-4 shadow-lg group-hover/card:shadow-xl transition-shadow border border-purple-200/50">
                          <svg
                            className="w-8 h-8 text-purple-600"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.75 2.524z" />
                          </svg>
                        </div>
                        <div className="flex items-center bg-gradient-to-r from-blue-100 to-blue-200 border border-blue-200 rounded-full px-4 py-2 shadow-sm">
                          <svg
                            className="w-4 h-4 text-blue-600 mr-2"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-blue-700 text-sm font-semibold">
                            Completed
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="relative z-10">
                      <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover/card:text-purple-600 transition-colors">
                        Bachelor of Technology in Computer Science Engineering
                      </h3>

                      <div className="flex items-center mb-4">
                        <div className="w-6 h-6 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center mr-3">
                          <svg
                            className="w-4 h-4 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z" />
                          </svg>
                        </div>
                        <h4 className="text-xl font-semibold text-purple-600">
                          Manipal University Jaipur
                        </h4>
                      </div>

                      <div className="flex items-center text-gray-600 mb-6">
                        <div className="w-5 h-5 bg-gradient-to-br from-gray-400 to-gray-500 rounded-lg flex items-center justify-center mr-3">
                          <Calendar className="w-3 h-3 text-white" />
                        </div>
                        <span className="font-medium">
                          July 2020 – July 2024
                        </span>
                      </div>

                      {/* Academic Achievements */}
                      <div className="space-y-3">
                        <h5 className="text-sm font-semibold text-gray-800 flex items-center">
                          <Award className="w-4 h-4 text-purple-500 mr-2" />
                          Key Highlights
                        </h5>
                        <div className="space-y-2">
                          <div className="flex items-start">
                            <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                            <p className="text-gray-600 text-sm">
                              Strong foundation in algorithms, data structures,
                              and software engineering principles
                            </p>
                          </div>
                          <div className="flex items-start">
                            <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                            <p className="text-gray-600 text-sm">
                              Extensive hands-on experience with modern web
                              technologies and frameworks
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-4">
                          <span className="px-3 py-1 bg-gradient-to-r from-purple-100 to-purple-200 text-purple-700 rounded-full text-xs font-medium border border-purple-200/50">
                            Computer Science
                          </span>
                          <span className="px-3 py-1 bg-gradient-to-r from-indigo-100 to-indigo-200 text-indigo-700 rounded-full text-xs font-medium border border-indigo-200/50">
                            Software Engineering
                          </span>
                          <span className="px-3 py-1 bg-gradient-to-r from-pink-100 to-pink-200 text-pink-700 rounded-full text-xs font-medium border border-pink-200/50">
                            Web Development
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Animated Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-600/5 to-indigo-600/5 rounded-3xl opacity-0 group-hover/card:opacity-100 transition-opacity duration-500"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Academic Journey Summary */}
            <div className="mt-16 text-center">
              <div className="inline-flex items-center bg-white/70 backdrop-blur-sm rounded-2xl px-8 py-6 border border-gray-200/50 shadow-lg max-w-2xl">
                <div className="grid grid-cols-3 gap-8 w-full">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-lg">
                      <span className="text-white font-bold text-lg">5+</span>
                    </div>
                    <p className="text-sm font-medium text-gray-700">
                      Years of Study
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-lg">
                      <span className="text-white font-bold text-lg">2</span>
                    </div>
                    <p className="text-sm font-medium text-gray-700">Degrees</p>
                  </div>
                  <div className="text-center">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-lg">
                      <span className="text-white font-bold text-lg">∞</span>
                    </div>
                    <p className="text-sm font-medium text-gray-700">
                      Learning
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Certifications Section */}
      <section
        id="certifications"
        className="py-20 bg-gradient-to-br from-slate-50 via-blue-50/20 to-purple-50/30 relative overflow-hidden"
      >
        {/* Enhanced Background Graphics */}
        {/* === Scroll-triggered animation logic === */}
        <div className="absolute inset-0">
          <div className="absolute top-1/4 -right-40 w-96 h-96 bg-gradient-to-bl from-blue-200/15 to-transparent rounded-full animate-pulse"></div>
          <div
            className="absolute bottom-1/3 -left-40 w-80 h-80 bg-gradient-to-tr from-purple-200/10 to-transparent rounded-full animate-pulse"
            style={{ animationDelay: "2s" }}
          ></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-indigo-100/5 to-blue-100/5 rounded-full"></div>
        </div>
        {/* Floating Achievement Icons */}
        <div className="absolute top-16 left-12 w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl shadow-xl flex items-center justify-center animate-float">
          <svg
            className="w-8 h-8 text-white"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </div>
        <div
          className="absolute top-32 right-20 w-14 h-14 bg-gradient-to-br from-green-400 to-green-600 rounded-xl shadow-xl flex items-center justify-center animate-float"
          style={{ animationDelay: "1s" }}
        >
          <Award className="w-7 h-7 text-white" />
        </div>
        <div
          className="absolute bottom-24 left-16 w-12 h-12 bg-gradient-to-br from-purple-400 to-purple-600 rounded-lg shadow-xl flex items-center justify-center animate-float"
          style={{ animationDelay: "3s" }}
        >
          <svg
            className="w-6 h-6 text-white"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          {/* Enhanced Header */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center bg-gradient-to-r from-yellow-100 to-orange-100 rounded-full px-6 py-3 mb-6 border border-yellow-200/50 shadow-sm">
              <Award className="w-5 h-5 text-yellow-600 mr-2" />
              <span className="text-yellow-800 font-medium text-sm">
                Professional Recognition
              </span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Certifications & Awards
            </h2>
            <div className="w-20 h-1 bg-gradient-to-r from-blue-600 to-purple-600 mx-auto mb-6"></div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Professional certifications that validate my expertise across
              various technologies and platforms
            </p>
          </div>

          {/* Enhanced Certifications Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {certifications.map((cert, index) => (
              <div
                key={index}
                className="group relative bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg hover:shadow-2xl transition-all duration-500 transform hover:-translate-y-3 border border-white/50 overflow-hidden"
                style={{
                  animationDelay: `${index * 150}ms`,
                }}
              >
                {/* Unique Background Pattern for Each Card */}
                <div
                  className={`
                  absolute inset-0 opacity-[0.02] bg-repeat
                  ${
                    index % 7 === 0
                      ? 'bg-[url(\'data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23000" fill-opacity="1"%3E%3Cpath d="M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z"%3E%3C/path%3E%3C/g%3E%3C/g%3E%3C/svg%3E\')]'
                      : ""
                  }
                  ${
                    index % 7 === 1
                      ? 'bg-[url(\'data:image/svg+xml,%3Csvg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="%23000" fill-opacity="1"%3E%3Ccircle cx="20" cy="20" r="4"%3E%3C/circle%3E%3C/g%3E%3C/svg%3E\')]'
                      : ""
                  }
                  ${
                    index % 7 === 2
                      ? 'bg-[url(\'data:image/svg+xml,%3Csvg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="%23000" fill-opacity="1"%3E%3Cpolygon points="10,0 20,20 0,20"%3E%3C/polygon%3E%3C/g%3E%3C/svg%3E\')]'
                      : ""
                  }
                  ${
                    index % 7 === 3
                      ? 'bg-[url(\'data:image/svg+xml,%3Csvg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="%23000" fill-opacity="1"%3E%3Cpath d="M20 20h40v40H20V20zm20 35a15 15 0 1 1 0-30 15 15 0 0 1 0 30z"%3E%3C/path%3E%3C/g%3E%3C/svg%3E\')]'
                      : ""
                  }
                  ${
                    index % 7 === 4
                      ? 'bg-[url(\'data:image/svg+xml,%3Csvg width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="%23000" fill-opacity="1"%3E%3Crect x="0" y="0" width="4" height="4"%3E%3C/rect%3E%3Crect x="8" y="8" width="4" height="4"%3E%3C/rect%3E%3C/g%3E%3C/svg%3E\')]'
                      : ""
                  }
                  ${
                    index % 7 === 5
                      ? 'bg-[url(\'data:image/svg+xml,%3Csvg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="%23000" fill-opacity="1"%3E%3Cpath d="M18 0l8 8h8v8l8 8-8 8v8h-8l-8 8-8-8H0v-8L-8 18l8-8V2h8l8-8z"%3E%3C/path%3E%3C/g%3E%3C/svg%3E\')]'
                      : ""
                  }
                  ${
                    index % 7 === 6
                      ? 'bg-[url(\'data:image/svg+xml,%3Csvg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="%23000" fill-opacity="1"%3E%3Cpath d="M12 0l12 12-12 12L0 12z"%3E%3C/path%3E%3C/g%3E%3C/svg%3E\')]'
                      : ""
                  }
                `}
                ></div>

                {/* Card Background Gradients */}
                <div
                  className={`
                  absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-16 translate-x-16 opacity-20 group-hover:opacity-30 transition-opacity
                  ${
                    index % 7 === 0
                      ? "bg-gradient-to-bl from-blue-400 to-blue-600"
                      : ""
                  }
                  ${
                    index % 7 === 1
                      ? "bg-gradient-to-bl from-green-400 to-green-600"
                      : ""
                  }
                  ${
                    index % 7 === 2
                      ? "bg-gradient-to-bl from-purple-400 to-purple-600"
                      : ""
                  }
                  ${
                    index % 7 === 3
                      ? "bg-gradient-to-bl from-orange-400 to-orange-600"
                      : ""
                  }
                  ${
                    index % 7 === 4
                      ? "bg-gradient-to-bl from-red-400 to-red-600"
                      : ""
                  }
                  ${
                    index % 7 === 5
                      ? "bg-gradient-to-bl from-yellow-400 to-yellow-600"
                      : ""
                  }
                  ${
                    index % 7 === 6
                      ? "bg-gradient-to-bl from-indigo-400 to-indigo-600"
                      : ""
                  }
                `}
                ></div>
                <div
                  className={`
                  absolute bottom-0 left-0 w-24 h-24 rounded-full translate-y-12 -translate-x-12 opacity-15 group-hover:opacity-25 transition-opacity
                  ${
                    index % 7 === 0
                      ? "bg-gradient-to-tr from-purple-400 to-purple-600"
                      : ""
                  }
                  ${
                    index % 7 === 1
                      ? "bg-gradient-to-tr from-blue-400 to-blue-600"
                      : ""
                  }
                  ${
                    index % 7 === 2
                      ? "bg-gradient-to-tr from-green-400 to-green-600"
                      : ""
                  }
                  ${
                    index % 7 === 3
                      ? "bg-gradient-to-tr from-red-400 to-red-600"
                      : ""
                  }
                  ${
                    index % 7 === 4
                      ? "bg-gradient-to-tr from-yellow-400 to-yellow-600"
                      : ""
                  }
                  ${
                    index % 7 === 5
                      ? "bg-gradient-to-tr from-purple-400 to-purple-600"
                      : ""
                  }
                  ${
                    index % 7 === 6
                      ? "bg-gradient-to-tr from-blue-400 to-blue-600"
                      : ""
                  }
                `}
                ></div>

                {/* Certificate Icon with Unique Colors */}
                <div className="flex items-start mb-6 relative z-10">
                  <div
                    className={`
                    w-16 h-16 rounded-2xl flex items-center justify-center mr-4 shadow-xl group-hover:shadow-2xl transition-all duration-300 transform group-hover:scale-110 group-hover:-rotate-3 relative overflow-hidden
                    ${
                      index % 7 === 0
                        ? "bg-gradient-to-br from-blue-500 to-blue-700"
                        : ""
                    }
                    ${
                      index % 7 === 1
                        ? "bg-gradient-to-br from-green-500 to-green-700"
                        : ""
                    }
                    ${
                      index % 7 === 2
                        ? "bg-gradient-to-br from-purple-500 to-purple-700"
                        : ""
                    }
                    ${
                      index % 7 === 3
                        ? "bg-gradient-to-br from-orange-500 to-orange-700"
                        : ""
                    }
                    ${
                      index % 7 === 4
                        ? "bg-gradient-to-br from-red-500 to-red-700"
                        : ""
                    }
                    ${
                      index % 7 === 5
                        ? "bg-gradient-to-br from-yellow-500 to-yellow-700"
                        : ""
                    }
                    ${
                      index % 7 === 6
                        ? "bg-gradient-to-br from-indigo-500 to-indigo-700"
                        : ""
                    }
                  `}
                  >
                    {/* Unique Icon for Each Certification Type */}
                    {index % 7 === 0 && (
                      <svg
                        className="w-8 h-8 text-white transform group-hover:scale-110 transition-transform"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" />
                      </svg>
                    )}
                    {index % 7 === 1 && (
                      <svg
                        className="w-8 h-8 text-white transform group-hover:scale-110 transition-transform"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                      </svg>
                    )}
                    {index % 7 === 2 && (
                      <svg
                        className="w-8 h-8 text-white transform group-hover:scale-110 transition-transform"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                      </svg>
                    )}
                    {index % 7 === 3 && (
                      <Award className="w-8 h-8 text-white transform group-hover:scale-110 transition-transform" />
                    )}
                    {index % 7 === 4 && (
                      <svg
                        className="w-8 h-8 text-white transform group-hover:scale-110 transition-transform"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                      </svg>
                    )}
                    {index % 7 === 5 && (
                      <svg
                        className="w-8 h-8 text-white transform group-hover:scale-110 transition-transform"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    )}
                    {index % 7 === 6 && (
                      <svg
                        className="w-8 h-8 text-white transform group-hover:scale-110 transition-transform"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3z" />
                      </svg>
                    )}

                    {/* Shimmer effect */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  </div>

                  {/* Verification Badge */}
                  <div className="ml-auto">
                    <div
                      className={`
                      w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-lg
                      ${index % 7 === 0 ? "bg-blue-500" : ""}
                      ${index % 7 === 1 ? "bg-green-500" : ""}
                      ${index % 7 === 2 ? "bg-purple-500" : ""}
                      ${index % 7 === 3 ? "bg-orange-500" : ""}
                      ${index % 7 === 4 ? "bg-red-500" : ""}
                      ${index % 7 === 5 ? "bg-yellow-500" : ""}
                      ${index % 7 === 6 ? "bg-indigo-500" : ""}
                    `}
                    >
                      <svg
                        className="w-4 h-4 text-white"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Certificate Content */}
                <div className="relative z-10">
                  <h3
                    className={`
                    text-lg font-bold mb-4 leading-tight group-hover:scale-105 transition-transform origin-left
                    ${
                      index % 7 === 0
                        ? "text-gray-900 group-hover:text-blue-600"
                        : ""
                    }
                    ${
                      index % 7 === 1
                        ? "text-gray-900 group-hover:text-green-600"
                        : ""
                    }
                    ${
                      index % 7 === 2
                        ? "text-gray-900 group-hover:text-purple-600"
                        : ""
                    }
                    ${
                      index % 7 === 3
                        ? "text-gray-900 group-hover:text-orange-600"
                        : ""
                    }
                    ${
                      index % 7 === 4
                        ? "text-gray-900 group-hover:text-red-600"
                        : ""
                    }
                    ${
                      index % 7 === 5
                        ? "text-gray-900 group-hover:text-yellow-600"
                        : ""
                    }
                    ${
                      index % 7 === 6
                        ? "text-gray-900 group-hover:text-indigo-600"
                        : ""
                    }
                  `}
                  >
                    {cert}
                  </h3>

                  {/* Provider/Platform Tag */}
                  <div className="flex items-center justify-between">
                    <div
                      className={`
                      px-3 py-1 rounded-full text-xs font-medium border shadow-sm
                      ${
                        index % 7 === 0
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : ""
                      }
                      ${
                        index % 7 === 1
                          ? "bg-green-50 text-green-700 border-green-200"
                          : ""
                      }
                      ${
                        index % 7 === 2
                          ? "bg-purple-50 text-purple-700 border-purple-200"
                          : ""
                      }
                      ${
                        index % 7 === 3
                          ? "bg-orange-50 text-orange-700 border-orange-200"
                          : ""
                      }
                      ${
                        index % 7 === 4
                          ? "bg-red-50 text-red-700 border-red-200"
                          : ""
                      }
                      ${
                        index % 7 === 5
                          ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                          : ""
                      }
                      ${
                        index % 7 === 6
                          ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                          : ""
                      }
                    `}
                    >
                      {cert.includes("LinkedIn")
                        ? "LinkedIn Learning"
                        : cert.includes("Udemy")
                        ? "Udemy"
                        : cert.includes("Cisco")
                        ? "Cisco"
                        : cert.includes("AWS")
                        ? "Amazon Web Services"
                        : cert.includes("UiPath")
                        ? "UiPath"
                        : "Verified"}
                    </div>

                    <div className="text-xs text-gray-500 font-medium">
                      2024
                    </div>
                  </div>
                </div>

                {/* Hover Overlay Effect */}
                <div
                  className={`
                  absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none
                  ${
                    index % 7 === 0
                      ? "bg-gradient-to-br from-blue-600/5 to-blue-800/5"
                      : ""
                  }
                  ${
                    index % 7 === 1
                      ? "bg-gradient-to-br from-green-600/5 to-green-800/5"
                      : ""
                  }
                  ${
                    index % 7 === 2
                      ? "bg-gradient-to-br from-purple-600/5 to-purple-800/5"
                      : ""
                  }
                  ${
                    index % 7 === 3
                      ? "bg-gradient-to-br from-orange-600/5 to-orange-800/5"
                      : ""
                  }
                  ${
                    index % 7 === 4
                      ? "bg-gradient-to-br from-red-600/5 to-red-800/5"
                      : ""
                  }
                  ${
                    index % 7 === 5
                      ? "bg-gradient-to-br from-yellow-600/5 to-yellow-800/5"
                      : ""
                  }
                  ${
                    index % 7 === 6
                      ? "bg-gradient-to-br from-indigo-600/5 to-indigo-800/5"
                      : ""
                  }
                `}
                ></div>

                {/* Card Number Indicator */}
                <div className="absolute top-4 right-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <span className="text-4xl font-black">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Enhanced Bottom Section */}
          <div className="mt-16 text-center">
            <div className="inline-flex items-center bg-white/70 backdrop-blur-sm rounded-2xl px-8 py-6 border border-gray-200/50 shadow-lg">
              <div className="grid grid-cols-3 gap-8 items-center">
                <div className="text-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-lg">
                    <span className="text-white font-bold text-lg">
                      {certifications.length}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-700">
                    Certifications
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-lg">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-700">
                    All Verified
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-2 shadow-lg">
                    <Award className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-sm font-medium text-gray-700">
                    Professional
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <div className="inline-flex items-center text-gray-600 bg-white/50 backdrop-blur-sm rounded-full px-6 py-3 border border-gray-200/50">
                <span className="mr-2">Continuously learning and growing</span>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Contact Section */}
      <section
        id="contact"
        className="py-20 bg-gradient-to-br from-gray-50 to-blue-50 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-blue-200/30 to-transparent rounded-full -translate-y-32 translate-x-32"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-purple-200/30 to-transparent rounded-full translate-y-32 -translate-x-32"></div>

        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Get In Touch
            </h2>
            <div className="w-20 h-1 bg-gradient-to-r from-blue-600 to-purple-600 mx-auto mb-8"></div>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              I'm always interested in new opportunities and exciting projects.
              Let's connect and discuss how we can work together!
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
            {/* Contact Info */}
            <div className="space-y-8">
              <div className="text-center lg:text-left">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">
                  Let's Connect
                </h3>
                <p className="text-gray-600 mb-8 leading-relaxed">
                  Whether you have a project in mind, want to discuss
                  opportunities, or just want to say hello, I'd love to hear
                  from you. Feel free to reach out through any of the channels
                  below or use the contact form.
                </p>
              </div>

              <div className="space-y-6">
                <div className="flex items-center p-4 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl transition-all">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-4">
                    <Mail className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Email</h4>
                    <a
                      href="mailto:shanthan678@gmail.com"
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      shanthan678@gmail.com
                    </a>
                  </div>
                </div>

                <div className="flex items-center p-4 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl transition-all">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mr-4">
                    <Phone className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Phone</h4>
                    <a
                      href="tel:+19024409840"
                      className="text-green-600 hover:text-green-800 transition-colors"
                    >
                      +1 902 440 9840
                    </a>
                  </div>
                </div>

                <div className="flex items-center p-4 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl transition-all">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to紫-600 rounded-xl flex items-center justify-center mr-4">
                    <Linkedin className="w-6 h-6 text白" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">LinkedIn</h4>
                    <a
                      href="https://linkedin.com/in/shanthan-reddy-nandhi-8bb862144"
                      className="text-purple-600 hover:text-purple-800 transition-colors"
                    >
                      Connect with me
                    </a>
                  </div>
                </div>

                <div className="flex items-center p-4 bg-white/80 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl transition-all">
                  <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center mr-4">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Location</h4>
                    <span className="text-indigo-600">
                      Halifax, Nova Scotia, Canada
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 shadow-xl">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                Send Message
              </h3>

              {submitStatus === "success" && (
                <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center mr-3">
                      <span className="text-white text-xs">✓</span>
                    </div>
                    <p className="text-green-800 font-medium">
                      Message sent successfully! I'll get back to you soon.
                    </p>
                  </div>
                </div>
              )}

              {submitStatus === "error" && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 font-medium">
                    Oops! Something went wrong. Please try again later.
                  </p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label
                      htmlFor="name"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Full Name *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                      placeholder="Your full name"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Email Address *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                      placeholder="your.email@example.com"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="subject"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Subject *
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                    placeholder="What's this about?"
                  />
                </div>

                <div>
                  <label
                    htmlFor="message"
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Message *
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    required
                    rows={5}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none resize-none"
                    placeholder="Tell me about your project or how I can help you..."
                  ></textarea>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all transform hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none shadow-lg hover:shadow-xl"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                      Sending Message...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      <Mail className="w-5 h-5 mr-2" />
                      Send Message
                    </span>
                  )}
                </button>
              </form>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <p className="text-sm text-gray-500 text-center">
                  I typically respond within 24 hours. Looking forward to
                  hearing from you!
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">
            © 2025 Shanthan Reddy Nandhi. Built with React.js and Tailwind CSS.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Portfolio;
