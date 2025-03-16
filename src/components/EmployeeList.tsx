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
import { useToast } from "@/components/ui/use-toast";
import { Loader2, RefreshCcw, Trash2, UserCog, Mail, User, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

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
  const { toast } = useToast();

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Failed to fetch employees');
      const data = await response.json();
      setEmployees(data);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load employees"
      });
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
  
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate password reset');
      }

      toast({
        title: "Success",
        description: `Password reset email sent to ${employee.firstName} ${employee.lastName} (${employee.email})`
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "An unexpected error occurred"
      });
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
      toast({
        title: "Success",
        description: "Employee removed successfully"
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to remove employee"
      });
    } finally {
      setActionInProgress(null);
    }
  };

  // Render loading skeletons for employees table instead of full-screen loader
  const renderSkeletons = () => {
    return Array(3).fill(0).map((_, index) => (
      <TableRow key={`skeleton-${index}`}>
        <TableCell>
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            {index === 1 && <Progress value={45} className="h-1 bg-gray-100" />}
          </div>
        </TableCell>
        <TableCell><Skeleton className="h-4 w-48" /></TableCell>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell className="text-right">
          <div className="flex justify-end gap-2">
            <Skeleton className="h-9 w-36" />
            <Skeleton className="h-9 w-9" />
          </div>
        </TableCell>
      </TableRow>
    ));
  };

  // Render mobile skeletons
  const renderMobileSkeletons = () => {
    return Array(3).fill(0).map((_, index) => (
      <Card key={`mobile-skeleton-${index}`} className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex justify-between items-start">
            <div className="space-y-2 w-3/4">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-32" />
              {index === 1 && <Progress value={45} className="h-1 bg-gray-100 my-1" />}
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100">
            <Skeleton className="h-8 w-full rounded-md" />
          </div>
        </CardContent>
      </Card>
    ));
  };

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
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">{loading ? "Loading..." : "Refresh"}</span>
        </Button>
      </div>
      
      {!loading && employees.length === 0 ? (
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
                {loading ? (
                  renderSkeletons()
                ) : (
                  employees.map((employee) => (
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
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile View */}
          <div className="md:hidden space-y-3">
            {loading ? (
              renderMobileSkeletons()
            ) : (
              employees.map((employee) => (
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
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
} 