const Employee = require("../models/employee");
const Credential = require("../models/credential");
const WorkCheck = require("../models/work_check");
const department = require("../models/department")
const bcrypt = require("bcrypt");
const validate = require("validate.js");
const jwt = require("jsonwebtoken");
class EmployeeService {

  async allEmployees(role, owner) {
    return new Promise((resolve, reject) => {
      const adminReg = /admin/i;
      if (!adminReg.test(role))
        reject({ message: "You are not authorized!", errCode: "AU-001" });
      Empoloyee.find(
        { email: { $ne: owner }, role: { $ne: "Admin" } },
        { email: 1, name: 1, role: 1 }
      ).populated(
        "department_Id", { department_name : 1 }
      ).then(employees => resolve(employees));
    });
  }
  
  async employee({ employee_Id }) {
    return new Promise(async (resolve, reject) => {
      const employee = await (await Employee.findOne({ employee_Id })).populated(
        "department_Id", { department_name : 1 }
      );
      return resolve(employee);
    });
  }

  async checkIn({ employee_Id }){
    return new Promise(async (resolve, reject) => {
      const employee = await Employee.findOne({ employee_Id })
      const pending_CheckOut = await WorkCheck.findOne({ employee_Id },{ is_CheckOut : false })
      if (pending_CheckOut){
        return resolve({
          message: "Error! A checkin is still pending for checkout",
          errCode: "CI-001"
        });
      }
      const check = new WorkCheck({
        name : employee.name,
        employee_Id : employee.employee_Id
      })
      await check.save()
      return resolve({
        message : "Successfully check in!"
      });
    });
  }

  async checkOut({ employee_Id }){
    return new Promise(async (resolve, reject) => {
      const pending_CheckOut = await WorkCheck.findOne({employee_Id}, { is_CheckOut : false })
      if (!pending_CheckOut){
        return resolve({
          message: "Error! No checkin is in pending for checkout",
          errCode: "CO-001"
        });
      }
      await WorkCheck.updateOne({ employee_Id }, {
        check_Out: Date.now(),
        is_CheckOut: true
      })
      return resolve({
        message : "Successfully checkout!"
      });
    });
  }

  async signUp({ email, name, pwd }) {
    return new Promise(async (resolve, reject) => {
      let reg = /[a-z,.]{4,}\d{0,4}@team.web.com/gi;
      let role = "";
      if (reg.test(email)) role = "Employee";
      else return resolve({ message: "Only @team.web.com is allowed", errCode: "SU-001" });
      bcrypt.genSalt(10, async (err, salt) => {
        bcrypt.hash(pwd, salt, async (err, hash) => {
          if (err) reject(err);
          try {
            department = await Department.findOne({ department_Name : "IT" })
            const employee = new Employee({
              email: email,
              name: name,
              role: role,
              department_Id: department._id
            });
            const credential = new Credential({
              pwd: hash,
              employee_Id: employee.employee_Id,
              role
            });
            await employee.save();
            await credential.save();
            return resolve({ message: "Account registered as successfully!" });
          } catch (err) {
            if (err.code == 11000)
              resolve({
                message: "Email is already registered!",
                errCode: "SU-002"
              });
            return resolve({ err: err.message, errCode: "SU-003" });
          }
        });
      });
    });
  }

  async signIn({ email, pwd }) {
    return new Promise(async (resolve, reject) => {
      const constraint = {
        email: {
          presence: true,
          email: true
        },
        password: {
          presence: true,
          length: {
            minimum: 4,
            maximum: 16,
            tooShort: "is too short",
            tooLong: "is too long"
          }
        }
      };
      const validateRes = validate({ email, pwd }, constraint);
      if (validateRes == undefined)
        return resolve({ message: "Invalid", success: false });
      const existEmployee = await Credential.findOne({ email: email });
      if (!existEmployee)
        return resolve({
          message: "Email does not match with any user",
          success: false,
          token: null
        });
      const employee = await Employee.findOne({ email });
      bcrypt.compare(pwd, existEmployee.pwd, (err, isMatch) => {
        if (err) return resolve({ err });
        if (isMatch) {
          // if the pwd matches
          // Sign the token
          const token = jwt.sign(
            { email: email, name: employee.name, role: employee.role, employee_Id: employee.employee_Id },
            process.env.TOKEN_SECRET
          );
          console.log("New Login from : " + email);
          //Put token in the header
          return resolve({ message: "Logged in successfully", success: true, token });
        } else {
          // if the pwd is not match
          //resolve({"message" : "Password entered is incorrect"})
          return resolve(
            resolve({
              message: "Incorrect password",
              success: false,
              token: null
            })
          );
        }
      });
    });
  }
  
}
module.exports = EmployeeService;
