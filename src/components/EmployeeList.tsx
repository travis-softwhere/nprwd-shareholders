import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, RefreshCcw, Trash2, UserCog, Mail, User, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Employee {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface EmployeeListProps {
  refreshTrigger?: number;
}

export function EmployeeList({ refreshTrigger = 0 }: EmployeeListProps) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch employees');
      const data = await response.json();
      setEmployees(data);
    } catch (error) {
      toast.error('Failed to load employees');
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  // Effect to fetch employees on initial load and when refreshTrigger changes
  useEffect(() => {
    fetchEmployees();
  }, [refreshTrigger]);

  const handleResetPassword = async (userId: string) => {
    setActionInProgress(userId);
    try {
      // Find the employee with the matching userId
      const employee = employees.find(emp => emp.id === userId);
      if (!employee) throw new Error("Employee not found");
  
      // Send both userId and email to the endpoint
      const response = await fetch(`/api/reset-password/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: employee.id, email: employee.email }),
      });
  
      if (!response.ok) throw new Error('Failed to initiate password reset');
      toast.success('Password reset email sent');
    } catch (error) {
      toast.error('Failed to send password reset email');
      console.error('Error resetting password:', error);
    } finally {
      setActionInProgress(null);
    }
  };
  
  const handleRemoveEmployee = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this employee?')) return;
    
    setActionInProgress(userId);
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to remove employee');
      setEmployees(employees.filter(emp => emp.id !== userId));
      toast.success('Employee removed successfully');
    } catch (error) {
      toast.error('Failed to remove employee');
      console.error('Error removing employee:', error);
    } finally {
      setActionInProgress(null);
    }
  };

  if (loading && employees.length === 0) {
    return (
      <div className="flex justify-center items-center p-8">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading employees...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-500" />
          Employees
        </h2>
        <Button 
          onClick={() => fetchEmployees()} 
          variant="outline" 
          size="sm"
          className="gap-1 text-blue-600"
        >
          <RefreshCcw className="h-4 w-4" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      </div>
      
      {employees.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <User className="h-10 w-10 text-gray-400 mx-auto mb-2" />
          <h3 className="text-lg font-medium text-gray-800 mb-1">No Employees Found</h3>
          <p className="text-gray-600 text-sm">
            Add employees using the form below to give them access to the system.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop View */}
          <div className="hidden md:block border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id} className="hover:bg-gray-50">
                    <TableCell className="font-medium">{`${employee.firstName} ${employee.lastName}`}</TableCell>
                    <TableCell>{employee.email}</TableCell>
                    <TableCell>{employee.username}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleResetPassword(employee.id)}
                          disabled={actionInProgress === employee.id}
                          className="gap-1"
                        >
                          {actionInProgress === employee.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Mail className="h-4 w-4" />
                              <span>Reset Password</span>
                            </>
                          )}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveEmployee(employee.id)}
                          disabled={actionInProgress === employee.id}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile View */}
          <div className="md:hidden space-y-3">
            {employees.map((employee) => (
              <Card key={employee.id} className="overflow-hidden hover:shadow-sm transition-shadow">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <User className="h-4 w-4 text-blue-500" />
                        <h3 className="font-medium text-gray-900">{`${employee.firstName} ${employee.lastName}`}</h3>
                      </div>
                      <p className="text-sm text-gray-500 flex items-center gap-1.5">
                        <Mail className="h-3 w-3 text-gray-400" />
                        {employee.email}
                      </p>
                      <p className="text-xs text-gray-500">
                        @{employee.username}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => handleRemoveEmployee(employee.id)}
                      disabled={actionInProgress === employee.id}
                      className="h-8 w-8"
                    >
                      {actionInProgress === employee.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResetPassword(employee.id)}
                      disabled={actionInProgress === employee.id}
                      className="w-full text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      {actionInProgress === employee.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Mail className="h-4 w-4 mr-2" />
                      )}
                      Reset Password
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
} 