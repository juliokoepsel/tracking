"""
Fabric Client Service
Handles all interactions with the Hyperledger Fabric network
"""
import json
import os
import subprocess
from typing import List, Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


class FabricClient:
    """Client for interacting with Hyperledger Fabric network"""

    def __init__(self):
        self.channel_name = os.getenv("CHANNEL_NAME", "deliverychannel")
        self.chaincode_name = os.getenv("CHAINCODE_NAME", "delivery")
        self.org_msp_id = os.getenv("ORG_MSP_ID", "DeliveryOrgMSP")
        self.peer_address = os.getenv("PEER_ADDRESS", "peer0.delivery.example.com:7051")
        
        # Paths for crypto material
        self.msp_config_path = "/app/organizations/peerOrganizations/delivery.example.com/users/Admin@delivery.example.com/msp"
        self.orderer_address = os.getenv("ORDERER_ADDRESS", "orderer.example.com:7050")

    def _execute_peer_command(self, args: List[str]) -> Dict[str, Any]:
        """
        Execute a peer command and return the result
        
        Args:
            args: List of command arguments
            
        Returns:
            Dictionary with success status and data/error
        """
        try:
            # Execute via docker exec into the CLI container
            cmd = ["docker", "exec", "cli", "peer"] + args
            logger.info(f"Executing command: {' '.join(cmd)}")
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode != 0:
                logger.error(f"Command failed: {result.stderr}")
                return {
                    "success": False,
                    "error": result.stderr or "Command execution failed"
                }
            
            # Try to parse JSON response
            output = result.stdout.strip()
            logger.info(f"Command output: {output}")
            
            try:
                data = json.loads(output)
                return {"success": True, "data": data}
            except json.JSONDecodeError:
                # If not JSON, return as string
                return {"success": True, "data": output}
                
        except subprocess.TimeoutExpired:
            logger.error("Command timeout")
            return {"success": False, "error": "Command execution timeout"}
        except Exception as e:
            logger.error(f"Command execution error: {str(e)}")
            return {"success": False, "error": str(e)}

    def invoke_chaincode(self, function: str, args: List[str]) -> Dict[str, Any]:
        """
        Invoke a chaincode function
        
        Args:
            function: Function name to invoke
            args: Function arguments
            
        Returns:
            Dictionary with success status and data/error
        """
        # Format args as JSON object with Args array
        chaincode_args = {
            "function": function,
            "Args": args
        }
        args_json = json.dumps(chaincode_args)
        
        cmd_args = [
            "chaincode", "invoke",
            "-o", self.orderer_address,
            "-C", self.channel_name,
            "-n", self.chaincode_name,
            "-c", args_json,
            "--waitForEvent"
        ]
        
        return self._execute_peer_command(cmd_args)

    def query_chaincode(self, function: str, args: List[str]) -> Dict[str, Any]:
        """
        Query a chaincode function
        
        Args:
            function: Function name to query
            args: Function arguments
            
        Returns:
            Dictionary with success status and data/error
        """
        # Format args as JSON object with Args array
        chaincode_args = {
            "function": function,
            "Args": args
        }
        args_json = json.dumps(chaincode_args)
        
        cmd_args = [
            "chaincode", "query",
            "-C", self.channel_name,
            "-n", self.chaincode_name,
            "-c", args_json
        ]
        
        return self._execute_peer_command(cmd_args)

    def create_delivery(self, delivery_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new delivery on the blockchain"""
        args = [
            delivery_data["deliveryId"],
            delivery_data["senderName"],
            delivery_data["senderAddress"],
            delivery_data["recipientName"],
            delivery_data["recipientAddress"],
            str(delivery_data["packageWeight"]),
            str(delivery_data["packageDimensions"]["length"]),
            str(delivery_data["packageDimensions"]["width"]),
            str(delivery_data["packageDimensions"]["height"]),
            delivery_data["packageDescription"],
            delivery_data["estimatedDeliveryDate"],
        ]
        
        return self.invoke_chaincode("CreateDelivery", args)

    def read_delivery(self, delivery_id: str) -> Dict[str, Any]:
        """Read a delivery from the blockchain"""
        return self.query_chaincode("ReadDelivery", [delivery_id])

    def update_delivery(
        self,
        delivery_id: str,
        recipient_address: str = "",
        delivery_status: str = ""
    ) -> Dict[str, Any]:
        """Update a delivery on the blockchain"""
        args = [delivery_id, recipient_address, delivery_status]
        return self.invoke_chaincode("UpdateDelivery", args)

    def delete_delivery(self, delivery_id: str) -> Dict[str, Any]:
        """Delete (cancel) a delivery on the blockchain"""
        return self.invoke_chaincode("DeleteDelivery", [delivery_id])

    def query_all_deliveries(self) -> Dict[str, Any]:
        """Query all deliveries from the blockchain"""
        return self.query_chaincode("QueryAllDeliveries", [])

    def get_delivery_history(self, delivery_id: str) -> Dict[str, Any]:
        """Get the history of a delivery"""
        return self.query_chaincode("GetDeliveryHistory", [delivery_id])

    def query_deliveries_by_status(self, status: str) -> Dict[str, Any]:
        """Query deliveries by status"""
        return self.query_chaincode("QueryDeliveriesByStatus", [status])


# Singleton instance
fabric_client = FabricClient()
